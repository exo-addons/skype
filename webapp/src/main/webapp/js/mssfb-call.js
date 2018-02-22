/**
 * Microsoft Skype for Business call application (web page). This script initializes an UI of a page that will handle a particular call.
 */
if (eXo.webConferencing) {
	(function(webConferencing) {
		"use strict";
		
	  // Start with default logger, later we'll get it for the provider.
		var log = webConferencing.getLog("mssfb").prefix("call");
		//log.trace("> Loading at " + location.origin + location.pathname);
		
		var errorCode = function(err) {
			return err && err.code ? err.code : "";
		};
		
		webConferencing.getProvider("mssfb").done(function(mssfb) {
			var hashLine = location.hash;
			var hasToken = /#access_token=/.test(hashLine);
			var hasError = /#error=/.test(hashLine);
			var isLogin = /\/login/.test(location.pathname);
			var isNewCall = /\/\w+\//.test(location.pathname); // need make an outgoing call
			var isP2PCall = /\/p\//.test(location.pathname); // incoming p2p call 
			var isGroupCall = /\/g\//.test(location.pathname); // incoming group call
			var isCall = isNewCall || isP2PCall || isGroupCall;
			var isClosed = false;

			function getParameterByName(name, url) {
				if (!url) {
					url = window.location.href;
				}
				name = name.replace(/[\[\]]/g, "\\$&");
				var regex = new RegExp("[?&#]" + name + "(=([^&#]*)|&|#|$)"), results = regex.exec(url);
				if (!results)
					return null;
				if (!results[2])
					return "";
				return decodeURIComponent(results[2].replace(/\+/g, " "));
			}

			function alignLoader() {
				var $throber = $("#mssfb-call-starting>.waitThrobber");
				if ($throber.length > 0) {
					var newHeight = $(window).height() - 30; // 15px for margins top/bottom
					var oldHeight = $throber.height();
					if (newHeight > 0) {
						$throber.height(newHeight);
					}
				}
			}
			
			function addToContainer($content) {
				var $container = $("div.mssfb-call-container");
				if ($container.length == 0) {
					$container = $("<div class='mssfb-call-container' style='display: none;'></div>");
					var newHeight = $(window).height() - 30; // 15px for margins top/bottom
					var oldHeight = $container.height();
					if (newHeight > 0) {
						$container.height(newHeight);
					}
					$(document.body).append($container);
				}
				$container.append($content);
				$container.show();
			}

			function decodeMessage(msg) {
				var dmsg = decodeURIComponent(msg);
				return dmsg.replace(/\+/g, " ");
			}

			function handleError() {
				$("#mssfb-call-conversation").hide();
				var $error = $("#mssfb-call-error");
				if ($error.length == 0) {
					$error = $("<div id='mssfb-call-error'></div>");
					addToContainer($error);
				}
				var hasharr = location.hash.substr(1).split("&");
				hasharr.forEach(function(hashelem) {
					var elemarr = hashelem.split("=");
					if (elemarr[0] == "error") {
						var $title = $("<h1 class='error-title'></h1>");
						$title.text(decodeMessage(elemarr[1]));
						$error.append($title);
					} else if (elemarr[0] == "error_description") {
						var $description = $("<div class='error-description'></div>");
						$description.text(decodeMessage(elemarr[1]));
						$error.append($description);
					} else {
						var $extrainfo = $("<div class='error-extrainfo'></div>");
						$extrainfo.text(decodeMessage(elemarr[0]) + ": " + decodeMessage(elemarr[1]));
						$error.append($extrainfo);
					}
				}, this);
			}

			function showError(title, message) {
				$("#mssfb-call-conversation, #mssfb-call-starting").hide();
				var $error = $("#mssfb-call-error");
				if ($error.length == 0) {
					$error = $("<div id='mssfb-call-error'></div>");
					addToContainer($error);
				}
				var $title = $("<h1 class='error-title'></h1>");
				$title.text(title);
				$error.append($title);
				var $description = $("<div class='error-description'></div>");
				$description.text(message);
				$error.append($description);
			}
			
			function showStarted(message) {
				var $starting = $("#mssfb-call-starting");
				$starting.empty();
				var $info = $(".startInfo");
				if ($info.length == 0) {
					$info = $("<div class='startInfo'></div>");
					$starting.append($info);
				}
				$info.text(message);
			}

			if (isLogin) {
				// FYI it's what WebSDK calls an "empty page"
				log.debug("Login page: " + mssfb.tokenHashInfo(hashLine));
				$(function() {
					alignLoader();
				});
				var parent = window.opener ? window.opener : (window.parent ? window.parent : null);
				if (hasToken) {
					// FYI we assume expiration time in seconds
					var param = getParameterByName("expires_in", hashLine);
					var expiresIn;
					try {
						expiresIn = parseInt(param);
					} catch(e) {
						log.warn("Error parsing token expiration time '" + param + "'", e);
						expiresIn = 0;
					}
					var token = {
						"access_token" : getParameterByName("access_token", hashLine),
						"token_type" : getParameterByName("token_type", hashLine),
						"session_state" : getParameterByName("session_state", hashLine),
						"hash_line" : hashLine,
						"expires_in" : expiresIn,
						"created" : Math.floor(new Date().getTime()/1000)
					};
					// FYI window.opener.eXo.webConferencing.mssfb.loginToken will exist only within provider.init() execution and short time
					// thus this if-block should not execute for call authentication
					if (parent && parent.eXo && parent.eXo.webConferencing && parent.eXo.webConferencing.mssfb) {
						//var parentUri = parent.location.href;
						//log.trace(">>>> MSSFB login opener: " + parentUri);
						// **** TODO experiments with ADSL to obtain auth token for SDK calls later
						/*var settings = {
									clientId : mssfb.getApiClientId(),
									cacheLocation: "localStorage"
								};
						var msOnlineContext = new AuthenticationContext(settings);
						msOnlineContext.login();
						msOnlineContext.acquireToken("https://login.microsoftonline.com/common", function(res) {
		        	log.trace("msOnlineContext.acquireTokenSilentAsync: " + JSON.stringify(res));
		        });
						var winGraphContext = new AuthenticationContext(settings);
						winGraphContext.acquireToken("https://graph.windows.net", function(res) {
		        	log.trace("winGraphContext.acquireTokenSilentAsync: " + JSON.stringify(res));
		        });*/
						//
						
						if (parent.eXo.webConferencing.mssfb.loginToken) {
							log.trace(">>> use parent.eXo.webConferencing.mssfb.loginToken()");
							parent.eXo.webConferencing.mssfb.loginToken(token).always(function() {
								log.info("Successfully authorized");
								showStarted("Successfully authorized in " + mssfb.getTitle() + " account."); // TODO is it correct sentense?
								setTimeout(function() {
									window.close();
								}, 2500);
							});	
						} else {
							log.warn("parent.eXo.webConferencing.mssfb.loginToken() not found");
						}
					} else {
						log.error("Login page has no opener or not initialized for callback token");
					}
				}
				if (hasError) {
					log.error("MSSFB login error: " + location.hash);
					handleError();
				}
			} else {
				$(function() {
					alignLoader();
					if (isCall) {
						log.debug("Call page: " + location.origin + location.pathname);
						var pageCallId;
						var ciIndex = location.pathname.indexOf("call/") + 5;
						if (ciIndex > 5 && location.pathname.length > ciIndex) {
							pageCallId = decodeURIComponent(location.pathname.substring(ciIndex));
							// We have call ID: it's call window, user may be already authenticated, but may be not
							if (hasToken) {
								// XXX Subscribe to the user call updates,
								// we don't need this, but do to connect CometD prior using addCall() in mssfb.startOutgoingCall()
								// See also https://jira.exoplatform.org/browse/PLF-7481
								var currentUserId = webConferencing.getUser().id;
								webConferencing.onUserUpdate(currentUserId, function(update) {
									if (update.eventType == "call_state") {
										if (update.callState == "stopped" && update.callId == pageCallId) {
											log.info("Call stopped remotelly: " + update.callId);
											//stopCallWaitClose(true);
										}							
									}
								}, function(err) {
									log.error("User calls subscription failure", err);
								});
								
								var redirectUri = webConferencing.getBaseUrl() + "/portal/skype/call/login";
								var uiInitializer = mssfb.uiApplication(redirectUri);
								uiInitializer.done(function(api, app) {
									try {
										log.debug("App created OK, user: " + app.personsAndGroupsManager.mePerson.displayName());
										var currentUserSip = app.personsAndGroupsManager.mePerson.id();
										
										$("#mssfb-call-starting").hide();
										var $convo = $("#mssfb-call-conversation");
										if ($convo.length == 0) {
											$convo = $("<div id='mssfb-call-conversation'></div>");
											addToContainer($convo);
										}
										var container = mssfb.newCallContainer($convo);
										
										log.debug("Conversation is creating: " + pageCallId);
										
										// It's a call request, call ID format for it: 'target_type'/'target_id', e.g. space/product_team
										var tdelim = pageCallId.indexOf("/");
										if (tdelim > 0 && tdelim < pageCallId.length - 1) {
											var startOutgoingCall = function(details) {
												mssfb.startOutgoingCall(api, app, container, details);
											};
											var targetType = pageCallId.substring(0, tdelim);
											var targetId = pageCallId.substring(tdelim + 1);
											if (targetType == "space") {
												webConferencing.getSpaceInfo(targetId).done(function(space) {
													var details = mssfb.readTargetDetails(currentUserSip, space);
													startOutgoingCall(details);
												}).fail(function(err) {
													log.error("Space info request failure for " + targetId + ": " + errorCode(err), err);
													showError("Space error", webConferencing.errorText(err));
												});
											} else if (targetType == "chat_room") {
												webConferencing.getRoomInfo(targetId).done(function(room) {
													var details = mssfb.readTargetDetails(currentUserSip, room);
													startOutgoingCall(details);
												}).fail(function(err) {
													log.error(" Room info request failure for " + targetId + ": " + errorCode(err), err);
													showError("Chat room error", err.message);
												});
											} else if (targetType == "user") {
												webConferencing.getUserInfo(targetId).done(function(user) {
													var details = mssfb.readTargetDetails(currentUserSip, user);
													startOutgoingCall(details);
												}).fail(function(err) {
													log.error("User info request failure for " + targetId + ": " + errorCode(err), err);
													showError("User error", err.message);
												});
											} else {
												log.error("Unsupported target type in call ID: " + pageCallId);
											}
										} else {
											log.error("Wrong call ID: " + pageCallId);
										}
									} catch (err) {
										log.error("Call error", err);
										showError("Call Error", err);
									}
								});
								uiInitializer.fail(function(err) {
									// TODO we have an error, check if it's auth problem, then force to login
									log.error("SkypeCC app error", err);
									showError("Application Error", webConferencing.errorText(err));
								});
							}
							if (hasError) {
								log.error("Call error: " + location.hash); // show fill hash, it contains an error
								handleError();
							}
						} else {
							log.error("Cannot find call ID in the page URL: " + location.pathname);
							showError("Application Error", "Cannot find call ID. Close the page and try again.");
						}
					} else {
						log.debug("Default page " + location.origin + location.pathname);
						var hasIdToken = /#id_token=/.test(hashLine);
						if (hasIdToken && location.hash.indexOf("admin_consent=True") >= 0) {
							log.info("ADMIN CONSENT: " + mssfb.tokenHashInfo(hashLine));
							var $root = $("#mssfb-call-root");
							if ($root.length == 0) {
								$root = $("<div id='mssfb-call-root'></div>");
								addToContainer($root);
							}
							var $title = $("<h1 class='consent-success'></h1>");
							$title.text("Success");
							$root.append($title);
							var $description = $("<h3 class='consent-description'></h3>");
							$description.text("Successfully granted app with Admin Consent");
							$root.append($description);
							var hasharr = location.hash.substr(1).split("&");
							hasharr.forEach(function(hashelem) {
								var elemarr = hashelem.split("=");
								var $info = $("<div class='consent-info'></div>");
								$info.text(decodeMessage(elemarr[0]) + ": " + decodeMessage(elemarr[1]));
								$root.append($info);
							}, this);
							addToContainer($("<p><a href='/portal'>Home</a></p>"));
						}
						if (hasToken) {
							log.debug("Got access token: " + mssfb.tokenHashInfo(hashLine));
							var $root = $("#mssfb-call-root");
							if ($root.length == 0) {
								$root = $("<div id='mssfb-call-root'></div>");
								addToContainer($root);
							}
							$root.text("Skype Calls default page. Please go to Portal Home and start a call from there.");
							addToContainer($("<div><a href='/portal'>Home</a></div>"));
						}
						if (hasError) {
							log.error("Default page error: " + location.hash);
							handleError();
						}
					}
				});
			}
		}).fail(function(err) {
			log.error("MSSFB provider not available for mssfb-call.js", err);
		});
		log.trace("< Loaded at " + location.origin + location.pathname);
	})(eXo.webConferencing);
} else {
	window.console && window.console.log("eXo.webConferencing not defined for mssfb-call.js");
}
