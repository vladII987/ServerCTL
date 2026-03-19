FROM golang:1.24-alpine AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN AGENT_VERSION=$(cat VERSION 2>/dev/null || echo "dev") && \
    GOOS=linux  GOARCH=amd64 go build -ldflags="-s -w -X main.agentVersion=${AGENT_VERSION}" -o /out/serverctl-agent-linux-amd64   . && \
    GOOS=linux  GOARCH=arm64 go build -ldflags="-s -w -X main.agentVersion=${AGENT_VERSION}" -o /out/serverctl-agent-linux-arm64   . && \
    GOOS=windows GOARCH=amd64 go build -ldflags="-s -w -X main.agentVersion=${AGENT_VERSION}" -o /out/serverctl-agent-windows-amd64.exe .

FROM alpine:3.20
COPY --from=builder /out/ /agent-bins/
CMD ["echo", "Agent binaries built"]
