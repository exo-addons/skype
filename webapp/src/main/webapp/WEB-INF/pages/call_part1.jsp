<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<title>Skype for Business Call</title>
	<link href="/skype/skin/mssfb-call.css" rel="stylesheet" type="text/css"/>
    <script type="text/javascript" src="/videocalls/js/jquery-3.2.1.js"></script>
    <script type="text/javascript" src="/videocalls/js/jquery-ui.min.js"></script>
    <script type="text/javascript" src="/videocalls/js/jquery.pnotify.min.js"></script>
    <!-- script src="https://secure.aadcdn.microsoftonline-p.com/lib/1.0.14/js/adal.min.js"></script -->
    <script type="text/javascript" src="https://swx.cdn.skype.com/shared/v/1.2.15/SkypeBootstrap.min.js"></script>
    <script type="text/javascript" src="/cometd/org/cometd.js"></script>
    <script type="text/javascript" src="/cometd/jquery/jquery.cometd.js"></script>
    <script>
	    //var cometd3Path="/cometd/javascript/eXo/commons/commons-cometd3.js";
    	var cCometD =