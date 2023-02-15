package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"cloud.google.com/go/storage"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
	log "github.com/sirupsen/logrus"
	"google.golang.org/api/iterator"
)

var bucket = "printqueue"
var expectedUpAccessToken string
var expectedDownAccessToken string

func serve() {
	s := NewServer()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	expectedUpAccessToken = os.Getenv("UPTOKEN")
	if expectedUpAccessToken == "" {
		panic(fmt.Errorf("env var UPTOKEN must be set"))
	}

	expectedDownAccessToken = os.Getenv("DOWNTOKEN")
	if expectedDownAccessToken == "" {
		panic(fmt.Errorf("env var DOWNTOKEN must be set"))
	}

	hs := http.Server{
		Handler:      s.router,
		Addr:         fmt.Sprintf("0.0.0.0:%s", port),
		WriteTimeout: 15 * time.Second,
		ReadTimeout:  15 * time.Second,
	}
	log.Printf("Starting HTTP server on addr: %s", hs.Addr)
	log.Fatal(hs.ListenAndServe())
}

type Server struct {
	router *mux.Router
	sc     *storage.Client
}

func NewServer() *Server {
	ctx := context.Background()
	sc, err := storage.NewClient(ctx)
	if err != nil {
		panic(err)
	}

	r := mux.NewRouter()
	s := Server{
		router: r,
		sc:     sc,
	}

	r.HandleFunc("/static/{?:.*}", s.Static).Methods("GET", "OPTIONS")
	r.HandleFunc("/{file}", s.Static).Methods("GET", "OPTIONS")
	// the main upload page UI
	r.HandleFunc("/", s.Static).Methods("GET", "OPTIONS")
	// the lab download page UI
	r.HandleFunc("/lab", s.Static).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/uptoken", s.CheckToken).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/upload", s.GetSignedUploadURL).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/finish", s.FinishUpload).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/files", s.ListFiles).Methods("GET", "OPTIONS")
	r.Use(logMiddleware)
	r.Use(corsMiddleware)

	return &s
}

func (s *Server) Static(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path
	if path == "/" {
		path = "/index.html"
	}
	if path == "/lab" {
		path = "/index.html"
	}

	http.ServeFile(w, r, filepath.Join("./js/build", path))
}

type GetSignedUploadRequest struct {
	Filename string `json:"filename"`
}

type GetSignedUploadURLResponse struct {
	Headers Headers `json:"headers"`
	ID      string  `json:"id"`
	URL     string  `json:"url"`
}

type Headers map[string]string

func (h *Headers) Array() []string {
	result := []string{}
	for k, v := range map[string]string(*h) {
		result = append(result, fmt.Sprintf("%s:%s", k, v))
	}

	return result
}

func (s *Server) CheckToken(w http.ResponseWriter, r *http.Request) {
	err := downPermissionCheck(r)
	if err != nil {
		writeError(w, err, http.StatusUnauthorized)
		return
	}
	writeSuccess(w, struct{}{})

}

func (s *Server) GetSignedUploadURL(w http.ResponseWriter, r *http.Request) {
	if err := upPermissionCheck(r); err != nil {
		writeError(w, err, http.StatusForbidden)
		return
	}

	req := GetSignedUploadRequest{}
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}

	if req.Filename == "" {
		writeError(w, fmt.Errorf("must specify filename"), http.StatusBadRequest)
		return
	}

	headers := Headers{
		"X-Goog-Content-Length-Range": fmt.Sprintf("0,%d", 50*1024*1024),
	}

	id := fmt.Sprintf("%s/%s", uuid.New().String(), req.Filename)
	u, err := s.sc.Bucket(bucket).SignedURL(id, &storage.SignedURLOptions{
		Method:  http.MethodPut,
		Scheme:  storage.SigningSchemeV4,
		Expires: time.Now().Add(15 * time.Minute),
		Headers: headers.Array(),
	})

	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	writeSuccess(w, &GetSignedUploadURLResponse{
		Headers: headers,
		ID:      id,
		URL:     u,
	})
}

type FinishUploadRequest struct {
	ID    string `json:"id"`
	Email string `json:"email"`
}

func (s *Server) FinishUpload(w http.ResponseWriter, r *http.Request) {
	if err := upPermissionCheck(r); err != nil {
		writeError(w, err, http.StatusForbidden)
		return
	}

	ctx := r.Context()
	req := FinishUploadRequest{}
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}

	if req.Email == "" {
		writeError(w, fmt.Errorf("must specify email"), http.StatusBadRequest)
		return
	}

	if req.ID == "" {
		writeError(w, fmt.Errorf("must specify id"), http.StatusBadRequest)
		return
	}

	h := s.sc.Bucket(bucket).Object(req.ID)
	oa, err := h.Attrs(ctx)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}
	if oa == nil {
		writeError(w, fmt.Errorf("not found"), http.StatusNotFound)
		return
	}
	metadata := oa.Metadata
	if metadata == nil {
		metadata = map[string]string{}
	}
	metadata["uploader"] = req.Email

	_, err = s.sc.Bucket(bucket).Object(oa.Name).Update(ctx, storage.ObjectAttrsToUpdate{Metadata: metadata})
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	writeSuccess(w, &struct{}{})
}

type ListFilesResult struct {
	Files []FileInfo `json:"files"`
}

type FileInfo struct {
	Name         string    `json:"name"`
	DownloadLink string    `json:"downloadLink"`
	Created      time.Time `json:"created"`
	Uploader     string    `json:"uploader"`
}

func (s *Server) ListFiles(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if err := downPermissionCheck(r); err != nil {
		writeError(w, err, http.StatusForbidden)
		return
	}

	files := []FileInfo{}
	it := s.sc.Bucket(bucket).Objects(ctx, nil)

	for {
		attrs, err := it.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			writeError(w, err, http.StatusInternalServerError)
			return
		}

		parts := strings.Split(attrs.Name, "/")
		originalName := parts[len(parts)-1]

		downloadLink, err := s.sc.Bucket(bucket).SignedURL(attrs.Name, &storage.SignedURLOptions{
			Method:  http.MethodGet,
			Expires: time.Now().Add(7 * 24 * time.Hour),
		})

		if err != nil {
			writeError(w, err, http.StatusInternalServerError)
			return
		}

		uploader := "anonymous"
		if attrs.Metadata != nil && attrs.Metadata["uploader"] != "" {
			uploader = attrs.Metadata["uploader"]
		}

		files = append(files, FileInfo{
			Name:         originalName,
			Created:      attrs.Created,
			DownloadLink: downloadLink,
			Uploader:     uploader,
		})
	}

	sort.Slice(files, func(i, j int) bool {
		// this function is called "Less"
		// we want to sort with newest first
		return files[i].Created.After(files[j].Created)
	})

	writeSuccess(w, &ListFilesResult{Files: files})
}

func permissionCheck(expected string, r *http.Request) error {
	token := r.URL.Query().Get("access_token")
	if token != expected {
		return fmt.Errorf(http.StatusText(http.StatusForbidden))
	}

	return nil
}

func upPermissionCheck(r *http.Request) error {
	return permissionCheck(expectedUpAccessToken, r)
}

func downPermissionCheck(r *http.Request) error {
	return permissionCheck(expectedDownAccessToken, r)
}

func writeSuccess(w http.ResponseWriter, responseBody any) error {
	w.Header().Add("Content-Type", "application/json")
	bs, err := json.Marshal(responseBody)
	if err != nil {
		return err
	}

	_, err = w.Write(bs)
	if err != nil {
		return err
	}
	return nil
}

func writeError(w http.ResponseWriter, err error, status int) {
	log.Errorf("Error: %v", err)
	w.WriteHeader(status)
	w.Write([]byte(err.Error()))
}
