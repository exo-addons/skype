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
package org.exoplatform.videocalls.webui;

import java.util.HashSet;
import java.util.Set;

import org.exoplatform.services.log.ExoLogger;
import org.exoplatform.services.log.Log;
import org.exoplatform.videocalls.VideoCallsException;
import org.exoplatform.videocalls.VideoCallsProvider;
import org.exoplatform.web.application.JavascriptManager;
import org.exoplatform.web.application.RequestContext;
import org.exoplatform.web.application.RequireJS;
import org.exoplatform.webui.application.WebuiRequestContext;

/**
 * Created by The eXo Platform SAS.
 *
 * @author <a href="mailto:pnedonosko@exoplatform.com">Peter Nedonosko</a>
 * @version $Id: VideoCallsContext.java 00000 Apr 28, 2017 pnedonosko $
 */
@Deprecated // TODO not used
public class VideoCallsContext {

  /** The Constant JAVASCRIPT. */
  protected static final String JAVASCRIPT = "VideoCallsContext_Javascript".intern();

  /** The Constant LOG. */
  protected static final Log    LOG        = ExoLogger.getLogger(VideoCallsContext.class);

  /**
   * This interface defines a way to customize the context by external logic.
   */
  @FunctionalInterface
  public interface Customizer {

    /**
     * Customize WebUI context.
     *
     * @param requestContext the WebUI request context
     */
    void customize(WebuiRequestContext requestContext);
  }

  /**
   * Initialize request with Video Calls support.
   *
   * @param requestContext {@link RequestContext}
   * @param provider the provider
   * @return the video calls context
   * @throws VideoCallsException the video calls exception
   */
  public static VideoCallsContext init(WebuiRequestContext requestContext,
                                       VideoCallsProvider provider) throws VideoCallsException {

    Object obj = requestContext.getAttribute(JAVASCRIPT);
    if (obj == null) {
      VideoCallsContext context = new VideoCallsContext(requestContext);

      requestContext.setAttribute(JAVASCRIPT, context);
      return context;
    } else if (VideoCallsContext.class.isAssignableFrom(obj.getClass())) {
      if (LOG.isDebugEnabled()) {
        LOG.debug("Request context already initialized");
      }
      return VideoCallsContext.class.cast(obj);
    } else {
      LOG.warn("Request context cannot be initialized as its attribute name (" + JAVASCRIPT
          + ") already consumed by " + obj);
      throw new VideoCallsException("Request context cannot be initialized as its attribute name already consumed");
    }
  }

  /** The providers. */
  private final Set<String> providers = new HashSet<String>();

  /** The require. */
  private final RequireJS   require;

  /**
   * Instantiates a new video calls context.
   *
   * @param requestContext the request context
   */
  private VideoCallsContext(WebuiRequestContext requestContext) {
    JavascriptManager js = requestContext.getJavascriptManager();
    this.require = js.require("SHARED/videoCalls", "videoCalls");
  }

}
