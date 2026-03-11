//go:build !windows

package main

func isWindowsService() bool {
	return false
}

func runWindowsService(cfg *Config) {
	// no-op on non-Windows
}
