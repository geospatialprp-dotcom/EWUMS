# GeoServer Configuration

GeoServer runs via Docker Compose on port 8080.

## Default Credentials

- URL: http://localhost:8080/geoserver
- Username: `admin`
- Password: `geoserver`

## Workspace Setup

Each tenant gets a workspace: `tenant_{slug}`

### Publishing PostGIS Layers

1. Create PostGIS datastore pointing to `egip` database
2. Publish layers from `assets` table filtered by `tenant_id`
3. Configure GeoWebCache for WMTS performance

## OGC Endpoints

```
WMS:  http://localhost:8080/geoserver/wms
WFS:  http://localhost:8080/geoserver/wfs
WMTS: http://localhost:8080/geoserver/gwc/service/wmts
```

## Styles

SLD style files are stored in `gis/geoserver/styles/`.
