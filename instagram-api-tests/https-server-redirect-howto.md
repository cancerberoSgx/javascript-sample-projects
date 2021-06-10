


# Generate certs
Same instructions as https://github.com/FiloSottile/mkcert
bew install mkcert
mkcert -install
mkcert example.com "*.example.com" example.test localhost 127.0.0.1 ::1



In /etc/hosts: 127.0.0.1 example.test

Add `https://example.test/` in your instagram redirect domains


sudo ts-node src/webapp/server.ts