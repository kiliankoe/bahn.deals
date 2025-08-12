.PHONY: all clean build-background

# Default target
all: build-background

## Build the bundled background/dist/index.js from modular files
build-background: extension/background/dist/index.js

extension/background/dist/index.js: extension/background/services/*.js extension/background/utils/*.js extension/background/main.js | extension/background/dist
	@echo "Building background/dist/index.js from modular files..."
	@echo "// Generated file - do not edit directly" > $@
	@echo "// Run 'make' to regenerate from source files" >> $@
	@echo "(function(){ self.browser = self.browser || self.chrome; })();" >> $@
	@echo "" >> $@
	@echo "// Utility Classes" >> $@
	@echo "" >> $@
	@sed 's/^export //' extension/background/utils/date-utils.js >> $@
	@echo "" >> $@
	@sed 's/^export //' extension/background/utils/coordinate-utils.js >> $@
	@echo "" >> $@
	@echo "// Service Classes" >> $@
	@echo "" >> $@
	@sed 's/^export //' extension/background/services/session-service.js >> $@
	@echo "" >> $@
	@sed 's/^export //' extension/background/services/options-service.js >> $@
	@echo "" >> $@
	@# Route service needs imports removed
	@grep -v '^import' extension/background/services/route-service.js | sed 's/^export //' >> $@
	@echo "" >> $@
	@sed 's/^export //' extension/background/services/pricing-service.js >> $@
	@echo "" >> $@
	@sed 's/^export //' extension/background/services/optimizer-service.js >> $@
	@echo "" >> $@
	@# Analysis service needs imports removed
	@grep -v '^import' extension/background/services/analysis-service.js | sed 's/^export //' >> $@
	@echo "" >> $@
	@# Append main (router + wiring)
	@cat extension/background/main.js >> $@
	@echo "Built background/dist/index.js successfully"

extension/background/dist:
	mkdir -p $@

# Clean generated files
clean:
	rm -f extension/background/dist/index.js
