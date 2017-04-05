package org.exoplatform.videocalls.jzportlet;

import javax.inject.Inject;
import javax.servlet.http.HttpServletRequest;

import org.exoplatform.portal.application.PortalRequestContext;
import org.exoplatform.portal.application.RequestNavigationData;
import org.exoplatform.portal.webui.util.Util;
import org.exoplatform.services.log.ExoLogger;
import org.exoplatform.services.log.Log;
import org.exoplatform.services.organization.OrganizationService;
import org.exoplatform.social.common.router.ExoRouter;
import org.exoplatform.social.common.router.ExoRouter.Route;
import org.exoplatform.social.core.space.model.Space;
import org.exoplatform.social.core.space.spi.SpaceService;
import org.exoplatform.videocalls.UserInfo;
import org.exoplatform.videocalls.VideoCallsService;
import org.exoplatform.ws.frameworks.json.impl.JsonGeneratorImpl;
import org.exoplatform.ws.frameworks.json.value.JsonValue;

import juzu.Path;
import juzu.Response;
import juzu.SessionScoped;
import juzu.View;
import juzu.request.ApplicationContext;
import juzu.request.SecurityContext;
import juzu.request.UserContext;
import juzu.template.Template;
import juzu.template.Template.Builder;

@SessionScoped
@Deprecated
public class VideoCallsApplication {

	private static final Log LOG = ExoLogger.getLogger(VideoCallsApplication.class);

	@Inject
	@Path("index.gtmpl")
	Template index;

	@Inject
	OrganizationService organizationService;

	@Inject
	SpaceService spaceService;

	@Inject
	VideoCallsService videocalls;

	@View
	public Response.Content index(ApplicationContext applicationContext, SecurityContext securityContext,
			UserContext userContext) throws Exception {
		PortalRequestContext requestContext = Util.getPortalRequestContext();

		HttpServletRequest request = requestContext.getRequest();
		// HttpSession httpSession = request.getSession();

		String remoteUser = securityContext.getRemoteUser();

		// String userFullName;

		UserInfo exoUser = videocalls.getUserInfo(remoteUser);
		// if (exoUser != null) {
		// userFullName = exoUser.getFirstName() + " " + exoUser.getLastName();
		// } else {
		// userFullName = remoteUser;
		// }

		// TODO Get bundle messages for status/error texts
		// Locale locale = userContext.getLocale();
		// ResourceBundle bundle = applicationContext.resolveBundle(locale);

		// Space
		String spacePrettyName, spaceRoomName;
		Space currSpace = getSpaceByContext();
		if (currSpace != null) {
			spacePrettyName = currSpace.getPrettyName();
			// TODO do we need a room name? what if chat room?
			spaceRoomName = spaceRoomName(currSpace);
		} else {
			spacePrettyName = spaceRoomName = "".intern();
		}

		// org.json:json from portal deosn't do the work good: IMs collection
		// doesn't searialized
		// JSONObject json = new JSONObject(exoUser);
		JsonValue value = new JsonGeneratorImpl().createJsonObject(exoUser);
		String exoUserJson = value.toString();

		Builder builder = index.with().set("user", exoUserJson).set("spaceName", spacePrettyName).set("spaceRoomName",
				spaceRoomName);
		return builder.ok();
	}

	protected String spaceRoomName(Space space) {
		StringBuilder sname = new StringBuilder();
		sname.append("eXoVideoCalls");
		String spaceName = space.getShortName();
		for (String s : spaceName.split("_")) {
			if (s.length() > 0) {
				sname.append(Character.toUpperCase(s.charAt(0)));
				if (s.length() > 1) {
					sname.append(s.substring(1));
				}
			}
		}
		sname.append("Space");
		return sname.toString();
	}

	private Space getSpaceByContext() {
		//
		PortalRequestContext pcontext = Util.getPortalRequestContext();
		String requestPath = pcontext.getControllerContext().getParameter(RequestNavigationData.REQUEST_PATH);
		Route route = ExoRouter.route(requestPath);
		if (route == null)
			return null;

		//
		String spacePrettyName = route.localArgs.get("spacePrettyName");
		return spaceService.getSpaceByPrettyName(spacePrettyName);
	}
}
