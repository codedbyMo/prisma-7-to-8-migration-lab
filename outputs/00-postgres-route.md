PostgreSQL route: embedded-postgres npm package binaries (zonkyio build), PostgreSQL 18.4, run as the postgres system user from /home/postgres (sandbox blocks Node-process chown under ~/workspace, so the package's own launcher could not be used; its extracted native binaries were used directly).

Connectivity proof (node pg client -> 127.0.0.1:54399, database lab):
CONNECT_OK {"v":"PostgreSQL 18.4 on x86_64-pc-linux-gnu, compiled by gcc (Ubuntu 7.5.0-3ubuntu1~18.04) 7.5.0, 64-bit","db":"lab"}
