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
package org.exoplatform.videocalls;

import org.exoplatform.container.ExoContainer;
import org.exoplatform.container.ExoContainerContext;
import org.exoplatform.portal.application.PortalRequestContext;
import org.exoplatform.portal.application.RequestNavigationData;
import org.exoplatform.portal.mop.SiteType;
import org.exoplatform.social.common.router.ExoRouter;
import org.exoplatform.social.common.router.ExoRouter.Route;
import org.exoplatform.social.core.space.SpaceUtils;
import org.exoplatform.social.core.space.model.Space;
import org.exoplatform.social.core.space.spi.SpaceService;
import org.exoplatform.videocalls.cometd.CometdVideoCallsService;
import org.exoplatform.webui.application.WebuiRequestContext;
import org.exoplatform.ws.frameworks.json.impl.JsonException;
import org.exoplatform.ws.frameworks.json.impl.JsonGeneratorImpl;
import org.exoplatform.ws.frameworks.json.value.JsonValue;

/**
 * Created by The eXo Platform SAS.
 *
 * @author <a href="mailto:pnedonosko@exoplatform.com">Peter Nedonosko</a>
 * @version $Id: VideoCallsUtils.java 00000 Mar 30, 2017 pnedonosko $
 */
public class VideoCallsUtils {

  /**
   * Generate a space room name.
   *
   * @param spacePrettyName the space pretty name
   * @return the string
   */
  public static String spaceRoomName(String spacePrettyName) {
    StringBuilder sname = new StringBuilder();
    sname.append("eXoVideoCalls");
    for (String s : spacePrettyName.split("_")) {
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

  /**
   * Gets the space by context.
   *
   * @return the space by context
   */
  public static Space getSpaceByContext() {
    WebuiRequestContext webuiContext = WebuiRequestContext.getCurrentInstance();
    if (webuiContext != null) {
      SpaceService spaceService = webuiContext.getUIApplication().getApplicationComponent(SpaceService.class);
      if (spaceService != null) {
        String spacePrettyName = getSpaceNameByContext();
        if (spacePrettyName != null) {
          return spaceService.getSpaceByPrettyName(spacePrettyName);
        }
      }
    }
    return null;
  }

  /**
   * Gets the space name by context.
   *
   * @return the space name in portal context
   */
  public static String getSpaceNameByContext() {
    // Idea of this method build on SpaceUtils.getSpaceByContext()
    PortalRequestContext portlalContext;
    WebuiRequestContext webuiContext = WebuiRequestContext.getCurrentInstance();
    if (webuiContext != null) {
      if (webuiContext instanceof PortalRequestContext) {
        portlalContext = (PortalRequestContext) webuiContext;
      } else {
        portlalContext = (PortalRequestContext) webuiContext.getParentAppRequestContext();
      }

      String requestPath = portlalContext.getControllerContext()
                                         .getParameter(RequestNavigationData.REQUEST_PATH);
      Route route = ExoRouter.route(requestPath);
      if (route != null) {
        if (portlalContext.getSiteType().equals(SiteType.GROUP)
            && portlalContext.getSiteName().startsWith(SpaceUtils.SPACE_GROUP)) {
          return route.localArgs.get("spacePrettyName");
        }
      }
    }
    return null;
  }

  /**
   * Gets the current context.
   *
   * @param userId the user id
   * @return the current context
   */
  public static ContextInfo getCurrentContext(String userId) {
    String spaceRoomName;
    String spacePrettyName = VideoCallsUtils.getSpaceNameByContext();
    if (spacePrettyName != null) {
      // TODO do we need a room name? what if chat room?
      spaceRoomName = VideoCallsUtils.spaceRoomName(spacePrettyName);
    } else {
      spacePrettyName = spaceRoomName = IdentityInfo.EMPTY;
    }
    ExoContainer exo = ExoContainerContext.getCurrentContainer();
    CometdVideoCallsService cometdService = exo.getComponentInstanceOfType(CometdVideoCallsService.class);
    if (cometdService != null) {
      return new ContextInfo(exo.getContext().getName(),
                             spacePrettyName,
                             spaceRoomName,
                             cometdService.getCometdServerPath(),
                             cometdService.getUserToken(userId));
    } else {
      return new ContextInfo(exo.getContext().getName(), spacePrettyName, spaceRoomName);
    }
  }

  /**
   * As JSON.
   *
   * @param obj the obj
   * @return the string
   * @throws JsonException the json exception
   */
  public static String asJSON(Object obj) throws JsonException {
    if (obj != null) {
      JsonGeneratorImpl gen = new JsonGeneratorImpl();
      if (obj.getClass().isArray()) {
        return gen.createJsonArray(obj).toString();
      } else {
        return gen.createJsonObject(obj).toString();
      }
    } else {
      return "null".intern();
    }
  }

}
