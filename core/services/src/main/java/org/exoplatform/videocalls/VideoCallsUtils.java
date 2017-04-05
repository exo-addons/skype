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

import java.io.IOException;

import org.exoplatform.portal.application.PortalRequestContext;
import org.exoplatform.portal.application.RequestNavigationData;
import org.exoplatform.portal.webui.util.Util;
import org.exoplatform.social.common.router.ExoRouter;
import org.exoplatform.social.common.router.ExoRouter.Route;
import org.exoplatform.social.core.space.model.Space;
import org.exoplatform.social.core.space.spi.SpaceService;
import org.exoplatform.ws.frameworks.json.impl.JsonException;
import org.exoplatform.ws.frameworks.json.impl.JsonGeneratorImpl;
import org.exoplatform.ws.frameworks.json.value.JsonValue;

/**
 * Created by The eXo Platform SAS
 * 
 * @author <a href="mailto:pnedonosko@exoplatform.com">Peter Nedonosko</a>
 * @version $Id: VideoCallsUtils.java 00000 Mar 30, 2017 pnedonosko $
 * 
 */
public class VideoCallsUtils {

  public static String spaceRoomName(Space space) {
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

  public static Space getSpaceByContext() {
    //
    PortalRequestContext pcontext = Util.getPortalRequestContext();
    String requestPath = pcontext.getControllerContext().getParameter(RequestNavigationData.REQUEST_PATH);
    Route route = ExoRouter.route(requestPath);
    if (route == null)
      return null;

    //
    String spacePrettyName = route.localArgs.get("spacePrettyName");
    SpaceService spaceService = pcontext.getUIApplication().getApplicationComponent(SpaceService.class);
    if (spaceService != null) {
      return spaceService.getSpaceByPrettyName(spacePrettyName);
    } else {
      return null;
    }
  }

  public static ContextInfo getCurrentContext() {
    String spacePrettyName, spaceRoomName;
    Space currSpace = VideoCallsUtils.getSpaceByContext();
    if (currSpace != null) {
      spacePrettyName = currSpace.getPrettyName();
      // TODO do we need a room name? what if chat room?
      spaceRoomName = VideoCallsUtils.spaceRoomName(currSpace);
    } else {
      spacePrettyName = spaceRoomName = "".intern();
    }
    return new ContextInfo(spacePrettyName, spaceRoomName);
  }
  
  public static String asJSON(Object obj) throws JsonException {
    JsonValue value = new JsonGeneratorImpl().createJsonObject(obj);
    return value.toString();
  }

}
