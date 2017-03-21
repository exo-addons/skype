
/*
 * Copyright (C) 2003-2016 eXo Platform SAS.
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

import org.exoplatform.container.ExoContainer;
import org.exoplatform.portal.webui.container.UIContainer;
import org.exoplatform.portal.webui.workspace.UIPortalApplication;
import org.exoplatform.services.log.ExoLogger;
import org.exoplatform.services.log.Log;
import org.exoplatform.web.application.Application;
import org.exoplatform.web.application.ApplicationLifecycle;
import org.exoplatform.web.application.RequestFailure;
import org.exoplatform.webui.application.WebuiRequestContext;
import org.exoplatform.webui.core.UIApplication;
import org.exoplatform.webui.core.UIComponent;
import org.exoplatform.webui.core.UIComponentDecorator;

/**
 * Prepare Video Calls site for showing without navigation bar from Platform's
 * shared layout.<br>
 * 
 * Created by The eXo Platform SAS
 * 
 * @author <a href="mailto:pnedonosko@exoplatform.com">Peter Nedonosko</a>
 * @version $Id: VideoCallsLifecycle.java 00000 Mar 14, 2017 pnedonosko $
 * 
 */
public class VideoCallsLifecycle implements ApplicationLifecycle<WebuiRequestContext> {

	/** The Constant LOG. */
	protected static final Log LOG = ExoLogger.getLogger(VideoCallsLifecycle.class);

	/** The toolbar rendered. */
	protected final ThreadLocal<Boolean> toolbarRendered = new ThreadLocal<Boolean>();

	/**
	 * Instantiates a new Video Calls lifecycle.
	 */
	public VideoCallsLifecycle() {
		//
	}

	/**
	 * {@inheritDoc}
	 */
	@Override
	public void onInit(Application app) throws Exception {
		// nothing
	}

	/**
	 * {@inheritDoc}
	 */
	@Override
	public void onStartRequest(Application app, WebuiRequestContext context) throws Exception {
		UIComponent toolbar = findToolbarComponent(app, context);
		if (toolbar != null && toolbar.isRendered()) {
			toolbarRendered.set(true);
			toolbar.setRendered(false);
		}
		// TODO do we need this in PLF 5.x?
		// XXX add WCMUtils and Bootsrap-Dropdown Javascript which is required
		// by UnifiedSearch portlet (it
		// doesn't depend on WCMUtils as QuicksearchPortlet does)
		// if (context.<HttpServletRequest>
		// getRequest().getRequestURI().indexOf("/outlook/search") > 0) {
		// context.getJavascriptManager().require("SHARED/bts_dropdown");
		// context.getJavascriptManager().require("SHARED/wcm-utils",
		// "wcm_utils");
		// }
	}

	/**
	 * {@inheritDoc}
	 */
	@Override
	public void onEndRequest(Application app, WebuiRequestContext context) throws Exception {
		UIComponent toolbar = findToolbarComponent(app, context);
		if (toolbar != null) {
			Boolean render = toolbarRendered.get();
			if (render != null && render.booleanValue()) {
				// restore rendered if was rendered and set hidden explicitly
				toolbar.setRendered(true);
			}
		}
	}

	/**
	 * {@inheritDoc}
	 */
	@Override
	public void onFailRequest(Application app, WebuiRequestContext context, RequestFailure failureType) {
		// nothing
	}

	/**
	 * {@inheritDoc}
	 */
	@Override
	public void onDestroy(Application app) throws Exception {
		// nothing
	}

	// ******* internals ******

	/**
	 * Find toolbar component.
	 *
	 * @param app
	 *            the app
	 * @param context
	 *            the context
	 * @return the UI component
	 * @throws Exception
	 *             the exception
	 */
	protected UIComponent findToolbarComponent(Application app, WebuiRequestContext context) throws Exception {
		ExoContainer container = app.getApplicationServiceContainer();
		if (container != null) {
			UIApplication uiApp = context.getUIApplication();
			UIComponentDecorator uiViewWS = uiApp.findComponentById(UIPortalApplication.UI_VIEWING_WS_ID);
			if (uiViewWS != null) {
				UIContainer viewContainer = (UIContainer) uiViewWS.getUIComponent();
				if (viewContainer != null) {
					UIContainer navContainer = viewContainer.getChildById("NavigationPortlet");
					if (navContainer == null) {
						navContainer = viewContainer;
					}
					for (UIComponent child : navContainer.getChildren()) {
						if (UIContainer.class.isAssignableFrom(child.getClass())) {
							UIContainer childContainer = UIContainer.class.cast(child);
							UIComponent toolbar = childContainer.getChildById("UIToolbarContainer");
							if (toolbar != null) {
								// attempt #1
								return toolbar;
							}
						}
					}
					// attempt #2
					return navContainer.findComponentById("UIToolbarContainer");
				}
			}
		}
		return null;
	}

}
