/*
 * 
 */
package org.exoplatform.videocalls.skype.jzportlet;

import java.net.URI;

import javax.inject.Inject;
import javax.servlet.http.HttpServletRequest;

import org.exoplatform.portal.application.PortalRequestContext;
import org.exoplatform.portal.webui.util.Util;
import org.exoplatform.services.log.ExoLogger;
import org.exoplatform.services.log.Log;
import org.exoplatform.videocalls.VideoCallsService;

import juzu.Path;
import juzu.Response;
import juzu.SessionScoped;
import juzu.View;
import juzu.request.ApplicationContext;
import juzu.request.SecurityContext;
import juzu.request.UserContext;
import juzu.template.Template;
import juzu.template.Template.Builder;

// TODO: Auto-generated Javadoc
/**
 * The Class SkypeCallApplication.
 */
@SessionScoped
public class SkypeCallApplication {

	/** The Constant LOG. */
	private static final Log LOG = ExoLogger.getLogger(SkypeCallApplication.class);

	/** The index. */
	@Inject
	@Path("index.gtmpl")
	Template index;

	/** The videocalls. */
	@Inject
	VideoCallsService videocalls; // TODO use dedicated service for Skype stuff

	/**
	 * Index.
	 *
	 * @param applicationContext the application context
	 * @param securityContext the security context
	 * @param userContext the user context
	 * @return the response. content
	 * @throws Exception the exception
	 */
	@View
	public Response.Content index(ApplicationContext applicationContext, SecurityContext securityContext,
			UserContext userContext) throws Exception {
		PortalRequestContext requestContext = Util.getPortalRequestContext();

		HttpServletRequest request = requestContext.getRequest();
		URI redirectURI = new URI(request.getScheme(), null, request.getServerName(), request.getServerPort(),
				"/portal/intranet/skype", null, null);

		// HttpSession httpSession = request.getSession();

		// String remoteUser = securityContext.getRemoteUser();

		// String userFullName;

		// UserInfo exoUser = videocalls.getUserInfo(remoteUser);
		// if (exoUser != null) {
		// userFullName = exoUser.getFirstName() + " " + exoUser.getLastName();
		// } else {
		// userFullName = remoteUser;
		// }

		// TODO Get bundle messages for status/error texts
		// Locale locale = userContext.getLocale();
		// ResourceBundle bundle = applicationContext.resolveBundle(locale);

		// TODO take parameters from config/settings
		// client_id - Application ID in Azure AD cdb8a8d9-7f58-4461-af22-f8f038457811
		// client_id - Object ID in Azure AD 1972edc0-9f9d-40ca-b114-3fe23bcbd733
		// TODO callTitle i18n
		Builder builder = index.with().set("name", "skype").set("title", "Skype").set("callTitle", "Call")
				.set("clientId", "cdb8a8d9-7f58-4461-af22-f8f038457811").set("redirectUri", redirectURI.toString())
				.set("version", "eXoWebSkype/1.0.0").set("apiKey", "a42fcebd-5b43-4b89-a065-74450fb91255")
				.set("apiKeyCC", "9c967f6b-a846-4df2-b43d-5167e47d81e1");

		return builder.ok();
	}

}
