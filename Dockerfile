FROM node:19.6-alpine3.17 as buildjs
WORKDIR /js
COPY js ./
RUN yarn install
RUN yarn run build

FROM golang:1.19.5-alpine3.17 as buildgo
WORKDIR /go/src/printqueue
COPY *.go ./
COPY go.mod ./
COPY go.sum ./
RUN go build 

FROM alpine:3.17.1
WORKDIR /app/js/build
COPY --from=buildjs /js/build ./
WORKDIR /app
COPY --from=buildgo /go/src/printqueue/printqueue .

ENTRYPOINT ["./printqueue", "-serve"]