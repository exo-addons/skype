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
package org.exoplatform.videocalls.skype.profile;

import org.exoplatform.container.component.BaseComponentPlugin;
import org.exoplatform.social.core.profile.settings.IMType;
import org.exoplatform.social.core.profile.settings.IMTypePlugin;
import org.exoplatform.videocalls.skype.SkypeProvider;
import org.exoplatform.webui.application.WebuiRequestContext;

/**
 * Created by The eXo Platform SAS.
 *
 * @author <a href="mailto:pnedonosko@exoplatform.com">Peter Nedonosko</a>
 * @version $Id: SkypeIMTypePlugin.java 00000 Apr 27, 2017 pnedonosko $
 */
public class SkypeIMTypePlugin extends BaseComponentPlugin implements IMTypePlugin {

  /**
   * The Class SkypeIMType.
   */
  class SkypeIMType implements IMType {

    /**
     * {@inheritDoc}
     */
    @Override
    public String getId() {
      return SkypeProvider.SKYPE_TYPE;
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public String getName() {
      return SkypeProvider.SKYPE_TITLE;
    }

    @Override
    public void initUI(WebuiRequestContext context, String imId) {
      // TODO add JS to the context?
    }
  }

  /**
   * Instantiates a new skype IM type plugin.
   */
  public SkypeIMTypePlugin() {
    //
  }

  /**
   * {@inheritDoc}
   */
  @Override
  public IMType getType() {
    return new SkypeIMType();
  }

}
