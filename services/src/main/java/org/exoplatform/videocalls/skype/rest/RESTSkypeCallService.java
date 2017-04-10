/*
 * Copyright (C) 2003-2017 eXo Platform SAS.
 *
 * This is free software; you can redistribute it and/or modify it
 * under the terms of the GNU Lesser General Public License as
 * published by the Free Software Foundation; either version 2.1 of
 * the License, or (at your option) any later version.
 *
 * This software is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this software; if not, write to the Free
 * Software Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA
 * 02110-1301 USA, or see the FSF site: http://www.fsf.org.
 */
package org.exoplatform.videocalls.skype.rest;

import javax.ws.rs.Path;

import org.exoplatform.services.log.ExoLogger;
import org.exoplatform.services.log.Log;
import org.exoplatform.services.rest.resource.ResourceContainer;
import org.exoplatform.videocalls.VideoCallsService;

/**
 * Created by The eXo Platform SAS.
 *
 * @author <a href="mailto:pnedonosko@exoplatform.com">Peter Nedonosko</a>
 * @version $Id: RESTVideoCallsService.java 00000 Feb 22, 2017 pnedonosko $
 */
@Path("/skype")
public class RESTSkypeCallService implements ResourceContainer {

  /** The Constant ME. */
  public static final String        ME  = "me";

  /** The Constant LOG. */
  protected static final Log        LOG = ExoLogger.getLogger(RESTSkypeCallService.class);

  /** The video calls. */
  protected final VideoCallsService videoCalls;

  /**
   * Instantiates a new REST Skype service.
   *
   * @param skype
   *          the skype
   */
  public RESTSkypeCallService(VideoCallsService skype) {
    this.videoCalls = skype;
  }

  /**
   * Call resource (page). It forwards internaly to a servlet.
   *
   * @param uriInfo the uri info
   * @param request the request
   * @param response the response
   * @param participants the participants
   * @return the user info response
   */
  /*
   * @GET
   * @RolesAllowed("users")
   * @Path("/call")
   * @Produces(MediaType.TEXT_HTML)
   * public Response forwardCallPage(@Context UriInfo uriInfo,
   * @Context HttpServletRequest request,
   * @Context HttpServletResponse response,
   * @QueryParam("call") String participants) {
   * ConversationState convo = ConversationState.getCurrent();
   * if (convo != null) {
   * String currentUserName = convo.getIdentity().getUserId();
   * request.setAttribute("currentUserName", currentUserName);
   * try {
   * // request.getRequestDispatcher("/WEB-INF/pages/call.jsp").forward(request, response);
   * ServletContext skypeContext =
   * request.getSession()
   * .getServletContext()
   * .getContext(SkypeCallFilter.SKYPE_SERVLET_CTX);
   * skypeContext.getRequestDispatcher(SkypeCallFilter.CALL_SERVLET).forward(request, response);
   * } catch (ServletException | IOException e) {
   * LOG.error("Error forwarding to call page for " + currentUserName, e);
   * return Response.status(Status.INTERNAL_SERVER_ERROR)
   * .entity(ErrorInfo.accessError("Internal error. Call cannot be started right now."))
   * .build();
   * }
   * return null;
   * } else {
   * return Response.status(Status.UNAUTHORIZED).entity(ErrorInfo.accessError("Unauthorized user")).build();
   * }
   * }
   */
}
