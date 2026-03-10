Name:           serverctl-agent
Version:        VERSION_PLACEHOLDER
Release:        1%{?dist}
Summary:        ServerCtl monitoring agent
License:        AGPL-3.0
BuildArch:      x86_64

%description
Lightweight agent that connects to a ServerCtl backend over WebSocket,
reports system metrics, and executes remote management commands.

%prep
%setup -q

%install
install -Dm755 %{name} %{buildroot}/usr/local/bin/%{name}
install -Dm644 config.yaml.example %{buildroot}/etc/serverctl-agent/config.yaml.example
install -Dm644 serverctl-agent.service %{buildroot}/lib/systemd/system/serverctl-agent.service

%post
if [ $1 -eq 1 ]; then
    # First install
    CONFIG=/etc/serverctl-agent/config.yaml
    if [ ! -f "$CONFIG" ]; then
        cp /etc/serverctl-agent/config.yaml.example "$CONFIG"
        chmod 600 "$CONFIG"
        echo "Created $CONFIG — edit it with your server_url and token."
    fi
    systemctl daemon-reload
    systemctl enable serverctl-agent
fi

%preun
if [ $1 -eq 0 ]; then
    # Full uninstall
    systemctl stop serverctl-agent || true
    systemctl disable serverctl-agent || true
fi

%postun
if [ $1 -eq 0 ]; then
    systemctl daemon-reload
fi

%files
/usr/local/bin/serverctl-agent
/etc/serverctl-agent/config.yaml.example
/lib/systemd/system/serverctl-agent.service

%changelog
* Mon Mar 10 2026 ServerCtl <admin@serverctl.local> - VERSION_PLACEHOLDER-1
- Initial Go rewrite
