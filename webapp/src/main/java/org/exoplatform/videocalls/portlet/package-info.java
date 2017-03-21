
@Application
@Portlet(name = "VideoCallsPortlet")

@Bindings({ @Binding(value = org.exoplatform.videocalls.VideoCallsService.class),
		@Binding(value = org.exoplatform.services.organization.OrganizationService.class),
		@Binding(value = org.exoplatform.social.core.space.spi.SpaceService.class) })

@Stylesheets({ @Stylesheet(id = "videocalls.css", value = "skin/videocalls.css", location = AssetLocation.SERVER),
		@Stylesheet(id = "jquery-ui.css", value = "skin/jquery-ui.min.css", location = AssetLocation.SERVER),
		@Stylesheet(id = "jquery-ui.structure.css", value = "skin/jquery-ui.structure.min.css", location = AssetLocation.SERVER),
		@Stylesheet(id = "jquery-ui.theme.css", value = "skin/jquery-ui.theme.min.css", location = AssetLocation.SERVER),
		@Stylesheet(id = "jquery.pnotify.default.css", value = "skin/jquery.pnotify.default.css", location = AssetLocation.SERVER),
		@Stylesheet(id = "jquery.pnotify.default.icons.css", value = "skin/jquery.pnotify.default.icons.css", location = AssetLocation.SERVER), })

@Scripts({ @Script(value = "js/videocallsapp.js", location = AssetLocation.SERVER) })

@Assets("*")

package org.exoplatform.videocalls.portlet;

import juzu.Application;
import juzu.asset.AssetLocation;
import juzu.plugin.asset.Assets;
import juzu.plugin.asset.Script;
import juzu.plugin.asset.Scripts;
import juzu.plugin.asset.Stylesheet;
import juzu.plugin.asset.Stylesheets;
import juzu.plugin.binding.Binding;
import juzu.plugin.binding.Bindings;
import juzu.plugin.portlet.Portlet;
