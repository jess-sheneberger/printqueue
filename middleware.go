package main

import (
	"net/http"

	log "github.com/sirupsen/logrus"
)

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Origin") != "" {
			w.Header().Set("Access-Control-Allow-Origin", r.Header.Get("Origin"))
			w.Header().Set("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,PATCH")
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Allow-Headers", "Accept,Content-Type,Content-Length,Accept-Encoding,X-CSRF-Token,Authorization,Content-Type,X-HTTP-Method-Override")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(200)
			return
		}
		next.ServeHTTP(w, r)

	})
}

func logMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("Request: %s %s", r.Method, r.URL)
		next.ServeHTTP(w, r)
	})
}
