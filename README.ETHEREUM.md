##README

# Node version:
openethereum-linux-v3.0.1

# Node site address:
https://github.com/openethereum/openethereum/releases

# Node direct link
https://github.com/openethereum/openethereum/releases/download/v3.0.1/openethereum-linux-v3.0.1.zip
https://github.com/openethereum/openethereum/releases/download/v3.0.1/openethereum-macos-v3.0.1.zip
https://github.com/openethereum/openethereum/releases/download/v3.0.1/openethereum-windows-v3.0.1.zip

# RabbitMQ
you have to create new VHOST(virtual host) named bch on your local RMQ (on server change it to "main" in .env)

# Node ubuntu service located /etc/systemd/system/openethereumd.service
[Unit]
Description=openethereumd
After=network.target
StartLimitIntervalSec=0

[Service]
Type=simple
Restart=always
RestartSec=10
StartLimitBurst=5
StartLimitIntervalSec=10
User=root
ExecStart=/home/ahmad/openethereum-linux-v3.0.1/openethereum --chain ropsten --config /home/ahmad/openethereum-linux-v3.0.1/config.toml

[Install]
WantedBy=multi-user.target

# Node config by default located ~/openethereum-linux-v3.0.1/config.toml
[parity]
mode = "active"
auto_update = "critical"
chain = "ropsten"
base_path= "/home/ahmad/openethereum-linux-v3.0.1/data"
light = false

[rpc]
disable = false
cors = ["*"]
interface = "all"
hosts = ["all"]
apis = ["all"]
port = 8545

[websockets]
disable = false
interface = "all"
origins = ["all"]
port = 8546
apis = ["all"]

[ipc]
chmod = "775"
disable = false
path = "/home/ubuntu/openethereum-linux-v3.0.1/jsonrpc.ipc"

[network]
port = 30303
allow_ips = "all"

# To avoid "TypeError: web3_1.default is not a constructor" with web3 package you have to:

set "esModuleInterop": true in compilerOptions block in tsconfig.json

