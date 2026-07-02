# Basic example

Three claims: `hello.txt` exists and is non-empty, its content contains
`"hello, verity"`, and `node --version` exits 0.

From this directory, after building verity (`npm run build` in the repo
root):

```
node ../../dist/cli.js verify claims.json
```

Expected output:

```
✓ hello-exists [file_exists] file exists and is non-empty — exists, 14 bytes
✓ hello-content [file_matches] content contains substring "hello, verity" — substring "hello, verity" found
✓ node-available [command] command exits 0 — exit 0

3 passed, 0 failed
OVERALL: PASS
```
