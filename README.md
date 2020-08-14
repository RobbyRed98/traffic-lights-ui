# traffic-lights-ui
Frontend for the traffic-lights controller.

## NPM scripts

### Install dependencies 
```bash
$ npm install
```

### Run a dev-server
```bash
$ npm run start
```

### Build a bundle
```bash
$ npm run build
```

### Adding offline support to the bundle

The commands require `sed` tool.

#### Add Roboto font offline support to bundle
```bash
$ npm run add-roboto
```

#### Add material icons offline support to bundle
```bash
$ npm run add-icons
```

### Clean build bundle dir (dist)
```bash
$ npm run clean
```

### Serve packed bundle
```bash
$ npm run serve-prod
```