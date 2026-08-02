PRODUCT ?= creator

.PHONY: dev test build-desktop

dev:
	ATLAS_PRODUCT=$(PRODUCT) .venv/bin/openworker-server --product $(PRODUCT)

test:
	ATLAS_PRODUCT=$(PRODUCT) .venv/bin/python -m pytest tests/test_atlas_product.py
	cd surfaces/gui && ATLAS_PRODUCT=$(PRODUCT) npm test -- --run src/product.test.ts

build-desktop:
	cd surfaces/gui && ATLAS_PRODUCT=$(PRODUCT) npm run tauri build -- --config ../../atlas/core/build/$(PRODUCT).tauri.conf.json
