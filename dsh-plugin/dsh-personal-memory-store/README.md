# dsh-personal-memory-store

A DSH bundle that exposes two tools:

- `memory_init` — create a personal memory store skeleton
- `memory_doctor` — read-only check against Personal Memory Store Specification 1.0

## Install

From a local checkout, in DSH **Plugins → Add plugin → local directory**, choose this folder. Or:

```
plugin_manager install_bundle target: <absolute path to this folder>
```

Once published to npm:

```
plugin_manager install_bundle target: dsh-personal-memory-store
```

It is a Host-only bundle: no build step, no runtime dependencies beyond the mounted `tools` service.

## Development

```bash
node --check index.js
```

The package declares `dsh.bundle.patch`, so installing it inserts the `personal-memory-store` row into the profile.

## License

MIT.
