//go:build windows

package main

import (
	"log"
	"time"

	"golang.org/x/sys/windows/svc"
)

type agentService struct {
	cfg *Config
}

func (s *agentService) Execute(args []string, r <-chan svc.ChangeRequest, changes chan<- svc.Status) (bool, uint32) {
	changes <- svc.Status{State: svc.StartPending}
	changes <- svc.Status{State: svc.Running, Accepts: svc.AcceptStop | svc.AcceptShutdown}

	// Run agent in background
	done := make(chan struct{})
	go func() {
		runAgent(s.cfg)
		close(done)
	}()

	for {
		select {
		case c := <-r:
			switch c.Cmd {
			case svc.Stop, svc.Shutdown:
				changes <- svc.Status{State: svc.StopPending}
				log.Println("[agent] Windows service stop requested")
				return false, 0
			case svc.Interrogate:
				changes <- c.CurrentStatus
				time.Sleep(100 * time.Millisecond)
				changes <- c.CurrentStatus
			}
		case <-done:
			return false, 0
		}
	}
}

func isWindowsService() bool {
	is, err := svc.IsWindowsService()
	if err != nil {
		return false
	}
	return is
}

func runWindowsService(cfg *Config) {
	err := svc.Run("serverctl-agent", &agentService{cfg: cfg})
	if err != nil {
		log.Fatalf("[agent] Windows service error: %v", err)
	}
}
