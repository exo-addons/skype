<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
    </script>
    <script type="text/javascript" src="/videocalls/js/videocalls.js"></script>
    <script type="text/javascript" src="/skype/js/videocalls-mssfb.js"></script>
    <script type="text/javascript">
	   	if (eXo.videoCalls) {
			(function(videoCalls) {
			  "use strict";
			  videoCalls.init(${userInfo}, ${contextInfo});
			  window.mssfbCallTitle = "${callTitle}";
			  videoCalls.mssfb.configure(${settings}); 
			  videoCalls.addProvider(videoCalls.mssfb);
			})(eXo.videoCalls);
	   	} else {
	   		console.log("eXo.videoCalls not defined for Skype for Business Call page");
	   	}
	</script>
</head>
<body>
	<div id="mssfb-call-starting">
		<div class="waitThrobber"></div>
	</div>
	<script type="text/javascript" src="/skype/js/mssfb-call.js"></script>	
</body>
</html>