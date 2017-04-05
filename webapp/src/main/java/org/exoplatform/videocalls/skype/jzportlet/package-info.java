
@Application
@Portlet(name = "SkypeCallPortlet")

@Bindings({ @Binding(value = org.exoplatform.videocalls.VideoCallsService.class),
		@Binding(value = org.exoplatform.services.organization.OrganizationService.class),
		@Binding(value = org.exoplatform.social.core.space.spi.SpaceService.class) })

@Stylesheets({ @Stylesheet(id = "skype.css", value = "skin/skype.css", location = AssetLocation.SERVER) })

@Scripts({ @Script(value = "js/skypecallapp.js", location = AssetLocation.SERVER) })

@Assets("*")

package org.exoplatform.videocalls.skype.jzportlet;

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
