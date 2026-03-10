VERSION    := 1.0.0
BINARY     := serverctl-agent
GO         := go
LDFLAGS    := -ldflags="-s -w -X main.version=$(VERSION)"

# Output dirs
OUT        := dist

.PHONY: all linux windows deb rpm clean deps

all: linux windows

deps:
	$(GO) mod tidy

# ─── Binaries ──────────────────────────────────────────────────────────────────

linux: deps
	mkdir -p $(OUT)
	GOOS=linux   GOARCH=amd64  $(GO) build $(LDFLAGS) -o $(OUT)/$(BINARY)-linux-amd64   .
	GOOS=linux   GOARCH=arm64  $(GO) build $(LDFLAGS) -o $(OUT)/$(BINARY)-linux-arm64   .
	@echo "Linux binaries → $(OUT)/"

windows: deps
	mkdir -p $(OUT)
	GOOS=windows GOARCH=amd64  $(GO) build $(LDFLAGS) -o $(OUT)/$(BINARY)-windows-amd64.exe .
	@echo "Windows binary → $(OUT)/$(BINARY)-windows-amd64.exe"

# ─── .deb package ──────────────────────────────────────────────────────────────
# Requires: dpkg-deb

deb: linux
	mkdir -p $(OUT)/deb-build/DEBIAN
	mkdir -p $(OUT)/deb-build/usr/local/bin
	mkdir -p $(OUT)/deb-build/etc/serverctl-agent
	mkdir -p $(OUT)/deb-build/lib/systemd/system

	cp $(OUT)/$(BINARY)-linux-amd64 $(OUT)/deb-build/usr/local/bin/$(BINARY)
	chmod 755 $(OUT)/deb-build/usr/local/bin/$(BINARY)

	cp packaging/deb/DEBIAN/control   $(OUT)/deb-build/DEBIAN/control
	cp packaging/deb/DEBIAN/postinst  $(OUT)/deb-build/DEBIAN/postinst
	cp packaging/deb/DEBIAN/prerm     $(OUT)/deb-build/DEBIAN/prerm
	chmod 755 $(OUT)/deb-build/DEBIAN/postinst $(OUT)/deb-build/DEBIAN/prerm

	cp packaging/deb/serverctl-agent.service $(OUT)/deb-build/lib/systemd/system/serverctl-agent.service
	cp packaging/config.yaml.example         $(OUT)/deb-build/etc/serverctl-agent/config.yaml.example

	dpkg-deb --build $(OUT)/deb-build $(OUT)/$(BINARY)_$(VERSION)_amd64.deb
	rm -rf $(OUT)/deb-build
	@echo "Deb package → $(OUT)/$(BINARY)_$(VERSION)_amd64.deb"

# ─── .rpm package ──────────────────────────────────────────────────────────────
# Requires: rpmbuild

rpm: linux
	mkdir -p ~/rpmbuild/{SPECS,SOURCES,BUILD,RPMS,SRPMS}
	mkdir -p ~/rpmbuild/SOURCES/$(BINARY)-$(VERSION)
	cp $(OUT)/$(BINARY)-linux-amd64 ~/rpmbuild/SOURCES/$(BINARY)-$(VERSION)/$(BINARY)
	cp packaging/config.yaml.example ~/rpmbuild/SOURCES/$(BINARY)-$(VERSION)/config.yaml.example
	cp packaging/rpm/serverctl-agent.service ~/rpmbuild/SOURCES/$(BINARY)-$(VERSION)/
	tar -czf ~/rpmbuild/SOURCES/$(BINARY)-$(VERSION).tar.gz -C ~/rpmbuild/SOURCES $(BINARY)-$(VERSION)
	cp packaging/rpm/serverctl-agent.spec ~/rpmbuild/SPECS/
	sed -i 's/VERSION_PLACEHOLDER/$(VERSION)/' ~/rpmbuild/SPECS/serverctl-agent.spec
	rpmbuild -bb ~/rpmbuild/SPECS/serverctl-agent.spec
	cp ~/rpmbuild/RPMS/x86_64/$(BINARY)-$(VERSION)-*.rpm $(OUT)/ 2>/dev/null || \
	  cp ~/rpmbuild/RPMS/x86_64/*.rpm $(OUT)/
	@echo "RPM package → $(OUT)/"

clean:
	rm -rf $(OUT)
