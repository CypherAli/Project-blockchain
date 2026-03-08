# ── Build stage ───────────────────────────────────────────────────────────────
FROM golang:1.22-alpine AS builder

# CGo disabled — pure Go, no libc dependency
ENV CGO_ENABLED=0 GOOS=linux GOARCH=amd64

WORKDIR /app

# Cache dependencies first
COPY go.mod go.sum ./
RUN go mod download

# Copy source + embedded migration SQL
COPY . .

# Build a single static binary
RUN go build -ldflags="-s -w" -o /indexer ./cmd/main.go

# ── Runtime stage — minimal scratch image ─────────────────────────────────────
FROM scratch

# TLS certificates (needed for HTTPS RPC calls)
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

COPY --from=builder /indexer /indexer

EXPOSE 3001

ENTRYPOINT ["/indexer"]
