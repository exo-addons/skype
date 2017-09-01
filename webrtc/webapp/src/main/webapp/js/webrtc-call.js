/**
 * WebRTC call application (web page). This script initializes an UI of a page that will handle a particular call.
 */
if (eXo.videoCalls) {
	(function(videoCalls) {
		"use strict";
		
		/** For debug logging. */
		var objId = Math.floor((Math.random() * 1000) + 1);
		var logPrefix = "[webrtccall_" + objId + "] ";
		var log = function(msg, e) {
			if (typeof console != "undefined" && typeof console.log != "undefined") {
				if (e) {
					console.log(logPrefix + msg + (typeof e == "string" ? (". Error: " + e) : JSON.stringify(e)));
					if (typeof e.stack != "undefined") {
						console.log(e.stack);
					}
				} else {
					console.log(logPrefix + msg);
				}
			}
		};
		// log("> Loading at " + location.origin + location.pathname);
		
		var isP2PCall = /\/p\//.test(location.pathname); // incoming p2p call
		var isGroupCall = /\/g\//.test(location.pathname); // incoming group call
		//var isHost = /\?host/.test(location.search); // create new call

		function alignLoader() {
			var $throber = $("#webrtc-call-starting>.waitThrobber");
			if ($throber.length > 0) {
				var newHeight = $(window).height() - 30; // 15px for margins top/bottom
				var oldHeight = $throber.height();
				if (newHeight > 0) {
					$throber.height(newHeight);
				}
			}
		}
		
		function addToContainer($content) {
			var $container = $("div.webrtc-call-container");
			if ($container.length == 0) {
				$container = $("<div class='webrtc-call-container' style='display: none;'></div>");
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

		function showError(title, message) {
			$("#webrtc-call-conversation, #webrtc-call-starting").hide();
			var $error = $("#webrtc-call-error");
			if ($error.length == 0) {
				$error = $("<div id='webrtc-call-error'></div>");
				addToContainer($error);
			}
//			var $title = $error.find(".error-title");
//			if ($title.length == 0) {
//				$title = $("<h1 class='error-title'></h1>");
//				$error.append($title);
//			}
//			$title.text(title);
//			var $description = $error.find(".error-description");
//			if ($description.length == 0) {
//				$description = $("<div class='error-description'></div>");
//				$error.append($description);
//			}
//			$description.text(message);

			// Append errors (for history)
			var $title = $("<h1 class='error-title'></h1>");
			$title.text(title);
			$error.append($title);
			var $description = $("<div class='error-description'></div>");
			$description.text(message);
			$error.append($description);
		}
		
		function showStarted(message) {
			var $starting = $("#webrtc-call-starting");
			$starting.empty();
			var $info = $(".startInfo");
			if ($info.length == 0) {
				$info = $("<div class='startInfo'></div>");
				$starting.append($info);
			}
			$info.text(message);
		}
		
		function objectUrl(obj) {
			if (window.URL) {
		  	return window.URL.createObjectURL(obj);
		  } else {
		  	return obj;
		  }
		}
		
		$(function() {
			alignLoader();
		});
		
		eXo.videoCalls.startCall = function(call) {
			var process = $.Deferred();
			$(function() {
				var webrtc = videoCalls.getProvider("webrtc");
				if (webrtc) {
					log(">> WebRTC call: " + location.origin + location.pathname);
					var callId = call.id;
					var isGroup = callId.startsWith("g/");
					if (isGroup) {
						log(">> Group calls not supported by WebRTC");
						showError("Warning", "Group calls not supported by WebRTC provider");
						setTimeout(function() {
							window.close();
						}, 7000);
						process.reject("Group calls not supported by WebRTC");
					} else {
						log("Preparing call " + callId + " > " + new Date().getTime());
						var currentUserId = videoCalls.getUser().id;
						var callerId = call.owner.id;
						var callerLink = call.ownerLink;
						var callerAvatar = call.avatarLink;
						var isOwner = currentUserId == callerId;  
						
						$("#webrtc-call-starting").hide();
						var $convo = $("#webrtc-call-conversation");
						if ($convo.length == 0) {
							$convo = $("<div id='webrtc-call-conversation'></div>");
							addToContainer($convo);
						}
						var $title = $("<div id='webrtc-call-title'><h1 class='call-title'>" + call.title + "</h1></div>");
						$convo.append($title);
						
						var $localVideo = $("<video id='video-local' autoplay></video>");
						$convo.append($localVideo);
						var $remoteVideo = $("<video id='video-remote' autoplay></video>");
						$convo.append($remoteVideo);
						var $controls = $("<div></div>");
						// var $startButton = $("<button id='start-button'>Start</button>");
						// var $callButton = $("<button id='call-button'>Call</button>");
						var $hangupButton = $("<button id='hangup-button'>Hang Up</button>");
						$controls.append($hangupButton);
						$convo.append($controls);
						// WebRTC connection to establish a call connection
						var pc = new RTCPeerConnection(); // TODO servers
						var handleError = function(title, message) {
							showError(title, message);
							if (!(pc.signalingState == "closed" || pc.connectionState == "closed")) {
								try {
									//pc.close();
								} catch(e) {
									log("WARN Failed to close peer connection: ", e);
								}								
							}
						}
						// Show current user camera in the video,
						// TODO if camera not found then show something for audio presence
						
						// var userMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
						var constraints = {
						  audio: true,
						  video: true
						};
						// TODO handle cases when video/audio not available
						navigator.mediaDevices.getUserMedia(constraints).then(function(localStream) {
							// successCallback
							// show local camera output
							// $localVideo.attr("src", objectUrl(localStream));
							var localVideo = $localVideo.get(0);
							localVideo.srcObject = localStream;
							localVideo.onloadedmetadata = function(event) {
								localVideo.play();
							};
						  // Subscribe to the call updates
							var listener = videoCalls.onCallUpdate(callId, function(message) {
								// TODO handle the remote side data
								if (message.provider == webrtc.getType()) {
									if (message.sender != currentUserId) {
										log(">>> Received call update for " + callId + ": " + JSON.stringify(message) + " > " + new Date().getTime());
										if (message.offer) {
											log(">>> Received offer for " + callId);
											// Offer of a caller on calee side
											// was: new RTCSessionDescription(message.offer)
											pc.setRemoteDescription(message.offer).then(function() {
												log(">>>> Apllied offer for " + callId + " > " + new Date().getTime());
									      // if we received an offer, we need to answer
									      if (pc.remoteDescription.type == "offer") {
									      	pc.createAnswer().then(function(desc) {
									      		pc.setLocalDescription(desc).then(function() {
									      			videoCalls.toCallUpdate(callId, {
												    		"provider" : webrtc.getType(),
												    		"sender" : currentUserId,
												    		"answer": pc.localDescription
												      }).done(function() {
												      	log(">>>>> Published answer to " + callId + " > " + new Date().getTime());
															}).fail(function(err) {
																log("ERROR publishing answer to " + callId + ": " + JSON.stringify(err));
																handleError("Error of sharing connection", err);
															});									      			
									      		}).catch(function(err) {
									      			log("ERROR setting local answer for " + callId + ": " + JSON.stringify(err));
										      		handleError("Error accepting call", err);
									      		});
									      	}).catch(function(err) {
									      		log("ERROR answering offer for " + callId + ": " + JSON.stringify(err));
									      		handleError("Error answering call", err);
									      	});
									      }
									    }).catch(function(err) {
									    	log("ERROR setting remote offer for " + callId + ": " + JSON.stringify(err));
									    	handleError("Error applying call", err);
									    });
										} else if (message.answer) {
											// Answer of a callee to the caller: it's final stage of the parties discovery
											log(">>> Received answer for " + callId);
											pc.setRemoteDescription(message.answer).then(function() {
									      log(">>>> Apllied answer for " + callId + " > " + new Date().getTime());
									    }).catch(function(err) {
									    	log("ERROR setting remote answer for " + callId + ": " + JSON.stringify(err));
									    	handleError("Error answering call", err);
									    });
										} else if (message.candidate) {
											// ICE candidate of remote party
											log(">>> Received candidate for " + callId);
											pc.addIceCandidate(new RTCIceCandidate(message.candidate)).then(function() {
									      log(">>>> Apllied candidate for " + callId + " > " + new Date().getTime());
									    }).catch(function(err) {
									    	log("ERROR adding candidate for " + callId + ": " + JSON.stringify(err));
									    	handleError("Error establishing call", err);
									    });
										} else if (message.hello) {
											// Initiator of the call sends "hello" - first message in the flow
											log(">>> Received hello for " + callId + ": " + JSON.stringify(message.hello) + " > " + new Date().getTime());
										} else if (message.bye) {
											// Remote part leaved the call: stop listen the call
											log(">>> Received bye for " + callId + ": " + JSON.stringify(message.bye) + " > " + new Date().getTime());
											listener.off();
											// TODO Tell local user, close the window?
										} else {
											log(">>> Received unexpected message for " + callId);
										}
									} else {
										//log("<<< skip own update");
									}
								}
							}, function(err) {
								log("ERROR subscribe to " + callId + ": " + JSON.stringify(err));
								process.reject("Error setting up connection (subscribe call updates): " + err);
								handleError("Connection error", err.message);
							});
							pc.onicecandidate = function (event) {
								// This will happen when browser will be ready to exchange peers setup
								log(">>> onIceCandidate for " + callId + ": " + JSON.stringify(event) + " > " + new Date().getTime());
						    if (event.candidate) {
						    	videoCalls.toCallUpdate(callId, {
						    		"provider" : webrtc.getType(),
						    		"sender" : currentUserId,
						    		// "type" : "candidate",
						    		// "sdpMLineIndex" : event.candidate.sdpMLineIndex,
						        // "sdpMid": event.candidate.sdpMid,
						        "candidate" : event.candidate
						      }).done(function() {
						      	log(">>>> Published candidate to " + callId);
						      	// At this stage we resolve the deferred process,
						      	// further errors (processing of remote updates) will not be reported to the caller
						      	// process.resolve("Started");
									}).fail(function(err) {
										log("ERROR publishing candidate to " + callId + ": " + JSON.stringify(err));
										// TODO retry or cancel the call?
										process.reject("Error of sharing connection (send call update): " + err);
										handleError("Error of sharing connection", err);
									});
						    } else {
						      // else All ICE candidates have been sent. ICE gathering has finished.
						    	// TODO any action is expected here?
						    }
						  };
						  if (isOwner) {
						 // let the 'negotiationneeded' event trigger offer generation
							  pc.onnegotiationneeded = function () {
							  	// This will be fired after adding a local media stream and browser readiness
							  	log(">>> onNegotiationNeeded for " + callId + " > " + new Date().getTime());
							    pc.createOffer().then(function(desc) {
							    	pc.setLocalDescription(desc).then(function() {
							    		videoCalls.toCallUpdate(callId, {
								    		"provider" : webrtc.getType(),
								    		"sender" : currentUserId,
								    		"hello": call.title
								      }).done(function() {
								      	log(">>>> Published hello to " + callId);
											}).fail(function(err) {
												log("ERROR publishing hello to " + callId + ": " + JSON.stringify(err));
											});
							        videoCalls.toCallUpdate(callId, {
								    		"provider" : webrtc.getType(),
								    		"sender" : currentUserId,
								    		"offer": JSON.stringify(pc.localDescription)
								      }).done(function() {
								      	log(">>>> Published offer to " + callId);
								      	// process.progress("Shared");
											}).fail(function(err) {
												log("ERROR publishing offer to " + callId + ": " + JSON.stringify(err));
												// TODO May retry?
												// process.reject("Error of sharing connection (send call update): " + err);
												handleError("Error of sharing connection", err);
											});
							      }).catch(function(err) {
							      	// process.reject("Error of preparing connection (setting local descriptor): " + err);
							      	log(">>> Error settings local offer for " + callId);
							      	handleError("Error of preparing connection", err);
								    });
							    }).catch(function(err) {
							    	// process.reject("Error of starting connection (create offer): " + err);
							    	log(">>> Error creating offer for " + callId);
							    	handleError("Error of starting connection", err);
							    });
							  };						  	
						  }
						  // once remote stream arrives, show it in the remote video element
						  /*pc.ontrack = function(event) {
						  	log(">>> onTrack for " + callId + " > " + new Date().getTime());
						  	$remoteVideo.get(0).srcObject = event.streams[0];
						  };*/
							pc.onaddstream = function (event) { 
								log(">>> onAddStream for " + callId + " > " + new  Date().getTime()); 
								//$remoteVideo.attr("src", objectUrl(event.stream));
								var video = $remoteVideo.get(0);
								video.srcObject = event.stream;
								video.onloadedmetadata = function(event1) {
									video.play();
								};
							};
						  pc.onremovestream = function(event) {
						  	// TODO check the event stream URL before removal?
						  	log(">>> onRemoveStream for " + callId + " > " + new Date().getTime());
						  	$remoteVideo.removeAttr("src");
						  };
						  // add local stream
						  pc.addStream(localStream); // It's deprecated way but Chrome works using it
						  //localStream.getTracks().forEach(function(track) {
						  //  pc.addTrack(track, localStream);
						  //});
						  
						  log("Starting call " + callId + " > " + new Date().getTime());
						  //
						  // process.progress("Starting");
						}).catch(function(err) {
							// errorCallback
							log(">> User media error: " + JSON.stringify(err));
							// process.reject("User media error: " + err);
							handleError("Media error", err);
						});
						process.resolve("Started");
					}
				} else {
					process.reject("WebRTC provider not found");
				}
			});
			return process.promise();
		};
		
		log("< Loaded at " + location.origin + location.pathname + " -- " + new Date().toLocaleString());
	})(eXo.videoCalls);
} else {
	console.log("eXo.videoCalls not defined for webrtc-call.js");
}
