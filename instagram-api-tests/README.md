efforts to access instagram user's data, mostly with a web server and oauth instagram app access.


# Generate certs for https local server

Same instructions as https://github.com/FiloSottile/mkcert

```
bew install mkcert
mkcert -install
mkcert example.com "*.example.com" example.test localhost 127.0.0.1 ::1
```


In /etc/hosts: 127.0.0.1 example.test

Add `https://example.test/` in your instagram redirect domains

sudo CLIENT_ID=1234 CLIENT_SECRET=2345 ts-node src/webapp/server.ts

# TODO

 * media pagination how to: https://developers.facebook.com/docs/graph-api/using-graph-api#paging   use limit, next, previous
 * https://developers.facebook.com/docs/instagram-basic-display-api/guides/long-lived-access-tokens
