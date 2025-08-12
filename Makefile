.PHONY: all clean build-background

# Default target
all: build-background

# Build the bundled background.js from modular files
build-background: extension/background.js

extension/background.js: extension/background/services/*.js extension/background/utils/*.js
	@echo "Building background.js from modular files..."
	@echo "// Generated file - do not edit directly" > $@
	@echo "// Run 'make' to regenerate from source files" >> $@
	@echo "" >> $@
	@echo "// Utility Classes" >> $@
	@echo "" >> $@
	@cat extension/background/utils/date-utils.js | sed 's/^export //' >> $@
	@echo "" >> $@
	@cat extension/background/utils/coordinate-utils.js | sed 's/^export //' >> $@
	@echo "" >> $@
	@echo "// Service Classes" >> $@
	@echo "" >> $@
	@cat extension/background/services/session-service.js | sed 's/^export //' >> $@
	@echo "" >> $@
	@cat extension/background/services/options-service.js | sed 's/^export //' >> $@
	@echo "" >> $@
	@# Route service needs imports removed
	@cat extension/background/services/route-service.js | grep -v '^import' | sed 's/^export //' >> $@
	@echo "" >> $@
	@cat extension/background/services/pricing-service.js | sed 's/^export //' >> $@
	@echo "" >> $@
	@cat extension/background/services/optimizer-service.js | sed 's/^export //' >> $@
	@echo "" >> $@
	@# Analysis service needs imports removed
	@cat extension/background/services/analysis-service.js | grep -v '^import' | sed 's/^export //' >> $@
	@echo "" >> $@
	@echo "// Initialize services" >> $@
	@echo "const sessionService = new SessionService();" >> $@
	@echo "const optionsService = new OptionsService();" >> $@
	@echo "const routeService = new RouteService();" >> $@
	@echo "const analysisService = new AnalysisService(routeService, optionsService);" >> $@
	@echo "" >> $@
	@echo "// Message router" >> $@
	@echo "browser.runtime.onMessage.addListener(async (msg, sender) => {" >> $@
	@echo "  if (!msg?.type) return;" >> $@
	@echo "  " >> $@
	@echo "  switch (msg.type) {" >> $@
	@echo "    case 'open-analysis':" >> $@
	@echo "      return sessionService.createSession(msg.selection);" >> $@
	@echo "      " >> $@
	@echo "    case 'get-analysis-selection':" >> $@
	@echo "      return sessionService.getSession(msg.token);" >> $@
	@echo "      " >> $@
	@echo "    case 'cleanup-session':" >> $@
	@echo "      return sessionService.cleanupSession(msg.token);" >> $@
	@echo "      " >> $@
	@echo "    case 'get-options':" >> $@
	@echo "      return optionsService.getOptions();" >> $@
	@echo "      " >> $@
	@echo "    case 'set-options':" >> $@
	@echo "      return optionsService.setOptions(msg.options);" >> $@
	@echo "      " >> $@
	@echo "    case 'fetch-route-only':" >> $@
	@echo "      return routeService.fetchRoute(msg.token, sessionService, optionsService);" >> $@
	@echo "      " >> $@
	@echo "    case 'start-analysis':" >> $@
	@echo "      return analysisService.startAnalysis(msg.token, msg.options, sessionService);" >> $@
	@echo "  }" >> $@
	@echo "});" >> $@
	@echo "Built background.js successfully"

# Clean generated files
clean:
	rm -f extension/background.js
