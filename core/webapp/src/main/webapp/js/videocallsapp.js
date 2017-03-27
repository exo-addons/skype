/**
 * Video Calls application (Juzu portlet) in eXo Platform. This script initializes UI of a page where it is loaded using
 * Video Calls module.
 */
require([ "SHARED/jquery", "SHARED/videoCalls" ], function($, videoCalls) {
	"use strict";
	
	var getIEVersion = function()
	// Returns the version of Windows Internet Explorer or a -1
	// (indicating the use of another browser).
	{
		var rv = -1;
		// Return value assumes failure.
		if (navigator.appName == "Microsoft Internet Explorer") {
			var ua = navigator.userAgent;
			var re = new RegExp("MSIE ([0-9]{1,}[\.0-9]{0,})");
			if (re.exec(ua) != null)
				rv = parseFloat(RegExp.$1);
		}
		return rv;
	};

	var updater;

	$(function() {
		if (videoCallsEnv) {
			// init environment
			videoCalls.init(videoCallsEnv.user, videoCallsEnv.space.name, videoCallsEnv.space.roomName);
			// TODO: do we want init calls buttons on the page right here, or wait for
			// providers with their buttons?
			videoCalls.update();

			// and later on DOM changes (when portlets will load by Ajax)
			var iev = getIEVersion();
			if (iev == -1 || iev >= 11) {
				// TODO as for IE<11 need use polyfills
				// http://webcomponents.org/polyfills/
				updater = setTimeout(
							function() {
								var portal = document.getElementById("UIPortalApplication");
								var MutationObserver = window.MutationObserver || window.WebKitMutationObserver
											|| window.MozMutationObserver;
								var observer = new MutationObserver(function(mutations) {
									// mutations.forEach(function(mutation) {
									// console.log(mutation.type);
									// });
									// TODO this will be fired twice on each update, try
									// reduce or use another approach
									// (call from WebUI server-side)
									videoCalls.update();
								});
								observer.observe(portal, {
									subtree : true,
									childList : true,
									attributes : false,
									characterData : false
								});
							}, 2500);
			}
		}
	});

	return {
		stop : function() {
			if (updater) {
				clearTimeout(updater);
			}
		}
	};
});
