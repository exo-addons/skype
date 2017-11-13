<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
    </script>
    <script type="text/javascript" src="/webconferencing/js/webconferencing.js"></script>
    <script type="text/javascript" src="/skype/js/webconferencing-mssfb.js"></script>
    <script type="text/javascript">
	   	if (eXo.webConferencing) {
			(function(webConferencing) {
			  "use strict";
			  webConferencing.init(${userInfo}, ${contextInfo});
			  webConferencing.mssfb.configure(${settings}); 
			  webConferencing.addProvider(webConferencing.mssfb);
			})(eXo.webConferencing);
	   	} else {
	   		console.log("eXo.webConferencing not defined for Skype for Business Call page");
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