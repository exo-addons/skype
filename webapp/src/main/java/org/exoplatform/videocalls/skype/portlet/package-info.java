
@Application
@Portlet(name = "SkypeCallPortlet")

@Bindings({ @Binding(value = org.exoplatform.videocalls.SkypeService.class),
		@Binding(value = org.exoplatform.services.organization.OrganizationService.class),
		@Binding(value = org.exoplatform.social.core.space.spi.SpaceService.class) })

@Stylesheets({ @Stylesheet(id = "skype.css", value = "skin/skype.css", location = AssetLocation.SERVER) })

@Scripts({
		@Script(id = "skype-uri", value = "http://www.skypeassets.com/i/scom/js/skype-uri.js", location = AssetLocation.URL),
		@Script(id = "skype-bootstrap", value = "https://swx.cdn.skype.com/shared/v/1.2.15/SkypeBootstrap.min.js", location = AssetLocation.URL),
		@Script(value = "js/skypecallapp.js", depends = { "skype-bootstrap",
				"skype.css" }, location = AssetLocation.SERVER) })

@Assets("*")

package org.exoplatform.videocalls.skype.portlet;

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
