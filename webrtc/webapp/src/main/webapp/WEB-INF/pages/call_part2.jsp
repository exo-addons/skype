<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
    </script>
    <script type="text/javascript" src="/videocalls/js/videocalls.js"></script>
    <script type="text/javascript" src="/webrtc/js/videocalls-webrtc.js"></script>
    <script type="text/javascript">
	   	if (eXo.videoCalls) {
			(function(videoCalls) {
			  "use strict";
			  videoCalls.init(${userInfo}, ${contextInfo});
			  videoCalls.webrtc.configure(${settings}); 
			  videoCalls.addProvider(videoCalls.webrtc);
			})(eXo.videoCalls);
	   	} else {
	   		console.log("eXo.videoCalls not defined for WebRTC Call page");
	   	}
	</script>
</head>
<body>
	<div id="webrtc-call-starting">
		<div class="waitThrobber"></div>
	</div>
	<script type="text/javascript" src="/webrtc/js/webrtc-call.js"></script>	
</body>
</html>