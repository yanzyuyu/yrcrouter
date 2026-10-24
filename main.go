package main

import (
	"context"
	"flag"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/yanzyuyu/yrcrouter/internal/config"
	"github.com/yanzyuyu/yrcrouter/internal/router"
	"github.com/yanzyuyu/yrcrouter/internal/web"
)

func main() {
	portFlag := flag.Int("port", 20128, "port to listen on")
	cfgPath := flag.String("config", "", "path to config.json")
	flag.Parse()

	store, err := config.NewStore(*cfgPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Config initialization failed: %v\n", err)
		os.Exit(1)
	}

	cfg := store.Get()
	port := *portFlag
	if port == 20128 && cfg.Port != 0 {
		port = cfg.Port
	}

	engine := router.NewEngine(store)
	server := web.NewServer(store, engine)

	mux := http.NewServeMux()
	server.RegisterRoutes(mux)

	addr := fmt.Sprintf("127.0.0.1:%d", port)
	httpServer := &http.Server{
		Addr:              addr,
		Handler:           mux,
		ReadHeaderTimeout: 15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	stopChan := make(chan os.Signal, 1)
	signal.Notify(stopChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		fmt.Printf("[ROUTER] listening on http://%s\n", addr)
		fmt.Printf("[ROUTER] v1 endpoint: http://%s/v1/chat/completions\n", addr)
		fmt.Printf("[ROUTER] dashboard:   http://%s\n", addr)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			fmt.Fprintf(os.Stderr, "Server error: %v\n", err)
			os.Exit(1)
		}
	}()

	<-stopChan
	fmt.Println("\n[ROUTER] shutting down gracefully...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := httpServer.Shutdown(ctx); err != nil {
		fmt.Fprintf(os.Stderr, "Shutdown error: %v\n", err)
	}
	fmt.Println("[ROUTER] stopped")
}
