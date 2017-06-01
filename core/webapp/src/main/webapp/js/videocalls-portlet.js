/**
 * Video Calls portlet in eXo Platform. This script initializes UI of a page where it is loaded using Video Calls
 * module.
 */
(function($, videoCalls) {
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

	var init = function(user, context) {
		$(function() {
			// init context
			videoCalls.init(user, context);
			videoCalls.update();

			// and later on DOM changes (when portlets will load by Ajax)
			var iev = getIEVersion();
			if (iev == -1 || iev >= 11) {
				// TODO as for IE<11 need use polyfills
				// http://webcomponents.org/polyfills/
				updater = setTimeout(
							function() {
								var targetId = "RightBody"; // was "UIPortalApplication" but it's not required and bad for perf
								var target = document.getElementById(targetId);
								if (!target) {
									target = document.getElementById("chat-application");
									if (!target) {
										target = document.getElementById("UIPortalApplication");
									}
								}
								if (target) {
									var MutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;
									var observer = new MutationObserver(function(mutations) {
										// FYI this will be fired twice on each update
										videoCalls.update(targetId);
									});
									observer.observe(target, {
										subtree : true,
										childList : true,
										attributes : false,
										characterData : false
									});									
								}
							}, 2500);
			}
		});
	};

	return {
		start : function(user, context) {
			init(user, context);
		},
		stop : function() {
			if (updater) {
				clearTimeout(updater);
			}
		}
	};
})($, videoCalls);
