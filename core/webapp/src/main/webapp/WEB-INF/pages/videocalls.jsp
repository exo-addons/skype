<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<%@ taglib uri="http://java.sun.com/portlet_2_0" prefix="portlet"%>
<%@ taglib uri="http://java.sun.com/jsp/jstl/core" prefix="c"%>
<%@ taglib uri="http://java.sun.com/jsp/jstl/functions" prefix="fn"%>
<%@ taglib uri="http://java.sun.com/jsp/jstl/fmt" prefix="fmt"%>
<%@ page import="java.util.Locale"%>
<%@ page import="java.util.ResourceBundle"%>
<%@ page trimDirectiveWhitespaces="true" %>
<%@ page import="org.exoplatform.webui.application.WebuiRequestContext" %>
<%@ page import="org.exoplatform.web.application.JavascriptManager" %>
<portlet:defineObjects />

<c:set var="resourceBundle" value="${portletConfig.getResourceBundle(renderRequest.locale)}"/>

<%--TODO not used! --%>
