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
package org.exoplatform.videocalls.rest;

import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Set;

import javax.annotation.security.RolesAllowed;
import javax.ws.rs.DELETE;
import javax.ws.rs.FormParam;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.Status;
import javax.ws.rs.core.UriInfo;

import org.exoplatform.services.log.ExoLogger;
import org.exoplatform.services.log.Log;
import org.exoplatform.services.rest.resource.ResourceContainer;
import org.exoplatform.services.security.ConversationState;
import org.exoplatform.videocalls.CallInfo;
import org.exoplatform.videocalls.GroupInfo;
import org.exoplatform.videocalls.UserInfo;
import org.exoplatform.videocalls.VideoCallsService;

/**
 * Created by The eXo Platform SAS.
 *
 * @author <a href="mailto:pnedonosko@exoplatform.com">Peter Nedonosko</a>
 * @version $Id: RESTVideoCallsService.java 00000 Feb 22, 2017 pnedonosko $
 */
@Path("/videocalls")
@Produces(MediaType.APPLICATION_JSON)
public class RESTVideoCallsService implements ResourceContainer {

  /** The Constant ME. */
  public static final String        ME  = "me";

  /** The Constant LOG. */
  protected static final Log        LOG = ExoLogger.getLogger(RESTVideoCallsService.class);

  /** The video calls. */
  protected final VideoCallsService videoCalls;

  /**
   * Instantiates a new REST video calls service.
   *
   * @param skype
   *          the skype
   */
  public RESTVideoCallsService(VideoCallsService skype) {
    this.videoCalls = skype;
  }

  /**
   * Gets the user info.
   *
   * @param uriInfo
   *          the uri info
   * @param userName
   *          the id
   * @return the user info response
   */
  @GET
  @RolesAllowed("users")
  @Path("/user/{name}")
  public Response getUserInfo(@Context UriInfo uriInfo, @PathParam("name") String userName) {
    ConversationState convo = ConversationState.getCurrent();
    if (convo != null) {
      String currentUserName = convo.getIdentity().getUserId();
      if (userName != null) {
        if (ME.equals(userName)) {
          userName = currentUserName;
        }
        try {
          UserInfo user = videoCalls.getUserInfo(userName);
          if (user != null) {
            return Response.ok().entity(user).build();
          } else {
            return Response.status(Status.NOT_FOUND)
                           .entity(ErrorInfo.notFoundError("User not found or not accessible"))
                           .build();
          }
        } catch (Throwable e) {
          LOG.error("Error reading user info of '" + userName + "' by '" + currentUserName + "'", e);
          return Response.serverError()
                         .entity(ErrorInfo.serverError("Error reading user " + userName))
                         .build();
        }
      } else {
        return Response.status(Status.BAD_REQUEST)
                       .entity(ErrorInfo.clientError("Wrong request parameters: name"))
                       .build();
      }
    } else {
      return Response.status(Status.UNAUTHORIZED).entity(ErrorInfo.accessError("Unauthorized user")).build();
    }
  }

  /**
   * Gets the users info.
   *
   * @param uriInfo
   *          the uri info
   * @param names
   *          user names
   * @return the users info response
   */
  @GET
  @RolesAllowed("users")
  @Path("/users")
  @Deprecated // TODO for future use
  public Response getUsersInfo(@Context UriInfo uriInfo, @QueryParam("names") String names) {
    ConversationState convo = ConversationState.getCurrent();
    if (convo != null) {
      String currentUserName = convo.getIdentity().getUserId();
      if (names != null) {
        try {
          Set<UserInfo> users = new LinkedHashSet<>();
          for (String userName : names.trim().split(",")) {
            if (ME.equals(userName)) {
              userName = currentUserName;
            }
            UserInfo user = videoCalls.getUserInfo(userName);
            if (user != null) {
              users.add(user);
            } else {
              if (LOG.isDebugEnabled()) {
                LOG.debug("Skipped not found user: " + userName);
              }
              return Response.status(Status.NOT_FOUND)
                             .entity(ErrorInfo.notFoundError("User " + userName
                                 + " not found or not accessible"))
                             .build();
            }
          }
          return Response.ok().entity(users.toArray()).build();
        } catch (Throwable e) {
          LOG.error("Error reading users info of '" + names + "' by '" + currentUserName + "'", e);
          return Response.serverError().entity(ErrorInfo.serverError("Error reading users " + names)).build();
        }
      } else {
        return Response.status(Status.BAD_REQUEST)
                       .entity(ErrorInfo.clientError("Wrong request parameters: names"))
                       .build();
      }
    } else {
      return Response.status(Status.UNAUTHORIZED).entity(ErrorInfo.accessError("Unauthorized user")).build();
    }
  }

  /**
   * Gets the space info.
   *
   * @param uriInfo
   *          the uri info
   * @param spaceName
   *          the space name
   * @return the space info response
   */
  @GET
  @RolesAllowed("users")
  @Path("/space/{spaceName}")
  public Response getSpaceInfo(@Context UriInfo uriInfo, @PathParam("spaceName") String spaceName) {
    ConversationState convo = ConversationState.getCurrent();
    if (convo != null) {
      String currentUserName = convo.getIdentity().getUserId();
      if (spaceName != null && spaceName.length() > 0) {
        try {
          GroupInfo space = videoCalls.getSpaceInfo(spaceName);
          if (space != null) {
            if (space.getMembers().containsKey(currentUserName)) {
              return Response.ok().entity(space).build();
            } else {
              return Response.status(Status.FORBIDDEN)
                             .entity(ErrorInfo.accessError("Not space member"))
                             .build();
            }
          } else {
            return Response.status(Status.NOT_FOUND)
                           .entity(ErrorInfo.notFoundError("Space not found or not accessible"))
                           .build();
          }
        } catch (Throwable e) {
          LOG.error("Error reading space info of '" + spaceName + "' by '" + currentUserName + "'", e);
          return Response.serverError()
                         .entity(ErrorInfo.serverError("Error reading space " + spaceName))
                         .build();
        }
      } else {
        return Response.status(Status.BAD_REQUEST)
                       .entity(ErrorInfo.clientError("Wrong request parameters: name"))
                       .build();
      }
    } else {
      return Response.status(Status.UNAUTHORIZED).entity(ErrorInfo.accessError("Unauthorized user")).build();
    }
  }

  @GET
  @RolesAllowed("users")
  @Path("/call/{type}/{id}")
  public Response getCallInfo(@Context UriInfo uriInfo,
                              @PathParam("type") String type,
                              @PathParam("id") String id) {
    ConversationState convo = ConversationState.getCurrent();
    if (convo != null) {
      String callId = callId(type, id);
      String currentUserName = convo.getIdentity().getUserId();
      try {
        CallInfo call = videoCalls.getCallInfo(callId);
        if (call != null) {
          return Response.ok().entity(call).build();
        } else {
          return Response.status(Status.NOT_FOUND).entity(ErrorInfo.notFoundError("Call not found")).build();
        }
      } catch (Throwable e) {
        LOG.error("Error reading call info for '" + callId + "' by '" + currentUserName + "'", e);
        return Response.serverError().entity(ErrorInfo.serverError("Error reading call information")).build();
      }
    } else {
      return Response.status(Status.UNAUTHORIZED).entity(ErrorInfo.accessError("Unauthorized user")).build();
    }
  }

  @DELETE
  @RolesAllowed("users")
  @Path("/call/{type}/{id}")
  public Response deleteCallInfo(@Context UriInfo uriInfo,
                                 @PathParam("type") String type,
                                 @PathParam("id") String id) {
    ConversationState convo = ConversationState.getCurrent();
    if (convo != null) {
      String callId = callId(type, id);
      String currentUserName = convo.getIdentity().getUserId();
      try {
        CallInfo call = videoCalls.removeCallInfo(callId);
        if (call != null) {
          return Response.ok().entity(call).build();
        } else {
          return Response.status(Status.NOT_FOUND).entity(ErrorInfo.notFoundError("Call not found")).build();
        }
      } catch (Throwable e) {
        LOG.error("Error removing call info for '" + callId + "' by '" + currentUserName + "'", e);
        return Response.serverError()
                       .entity(ErrorInfo.serverError("Error removing call information"))
                       .build();
      }
    } else {
      return Response.status(Status.UNAUTHORIZED).entity(ErrorInfo.accessError("Unauthorized user")).build();
    }
  }

  @POST
  @RolesAllowed("users")
  @Path("/call/{type}/{id}")
  public Response postCallInfo(@Context UriInfo uriInfo,
                               @PathParam("type") String type,
                               @PathParam("id") String id,
                               @FormParam("title") String title,
                               @FormParam("provider") String providerType,
                               @FormParam("owner") String ownerId,
                               @FormParam("ownerType") String ownerType,
                               @FormParam("participants") String participants) {
    ConversationState convo = ConversationState.getCurrent();
    if (convo != null) {
      String callId = callId(type, id);
      if (title != null) {
        if (providerType != null) {
          if (ownerId != null) {
            if (ownerType != null) {
              if (participants != null) {
                String currentUserName = convo.getIdentity().getUserId();
                try {
                  CallInfo call =
                                videoCalls.addCallInfo(callId,
                                                       ownerId,
                                                       ownerType,
                                                       title,
                                                       providerType,
                                                       Arrays.asList(participants.split(";")));
                  return Response.ok().entity(call).build();
                } catch (Throwable e) {
                  LOG.error("Error creating call info for '" + callId + "' by '" + currentUserName + "'", e);
                  return Response.serverError()
                                 .entity(ErrorInfo.serverError("Error creating call record"))
                                 .build();
                }
              } else {
                return Response.status(Status.BAD_REQUEST)
                               .entity(ErrorInfo.clientError("Wrong request parameters: participants"))
                               .build();
              }
            } else {
              return Response.status(Status.BAD_REQUEST)
                             .entity(ErrorInfo.clientError("Wrong request parameters: ownerType"))
                             .build();
            }
          } else {
            return Response.status(Status.BAD_REQUEST)
                           .entity(ErrorInfo.clientError("Wrong request parameters: owner"))
                           .build();
          }
        } else {
          return Response.status(Status.BAD_REQUEST)
                         .entity(ErrorInfo.clientError("Wrong request parameters: provider"))
                         .build();
        }
      } else {
        return Response.status(Status.BAD_REQUEST)
                       .entity(ErrorInfo.clientError("Wrong request parameters: title"))
                       .build();
      }
    } else {
      return Response.status(Status.UNAUTHORIZED).entity(ErrorInfo.accessError("Unauthorized user")).build();
    }
  }

  private String callId(String type, String id) {
    return new StringBuffer(type).append('/').append(id).toString();
  }
}
