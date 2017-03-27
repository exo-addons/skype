/*
 * Copyright (C) 2003-2015 eXo Platform SAS.
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

/**
 * Basic error entity.<br>
 * 
 * Created by The eXo Platform SAS
 * 
 * @author <a href="mailto:pnedonosko@exoplatform.com">Peter Nedonosko</a>
 * @version $Id: ErrorInfo.java 00000 Apr 20, 2015 pnedonosko $
 * 
 */
public class ErrorInfo {

  public static final String CODE_CLIENT_ERROR    = "CLIENT_ERROR";

  public static final String CODE_NOT_FOUND_ERROR = "NOT_FOUND_ERROR";

  public static final String CODE_ACCESS_ERROR    = "ACCESS_ERROR";

  public static final String CODE_SERVER_ERROR    = "SERVER_ERROR";

  public static ErrorInfo clientError(String message) {
    return new ErrorInfo(CODE_CLIENT_ERROR, message);
  };

  public static ErrorInfo notFoundError(String message) {
    return new ErrorInfo(CODE_NOT_FOUND_ERROR, message);
  };

  public static ErrorInfo accessError(String message) {
    return new ErrorInfo(CODE_ACCESS_ERROR, message);
  };

  public static ErrorInfo serverError(String message) {
    return new ErrorInfo(CODE_SERVER_ERROR, message);
  };

  protected final String code;

  protected final String message;

  /**
   * 
   */
  public ErrorInfo(String code, String message) {
    this.code = code;
    this.message = message;
  }

  /**
   * 
   */
  public ErrorInfo(String message) {
    this(null, message);
  }

  /**
   * @return the code
   */
  public String getCode() {
    return code;
  }

  /**
   * @return the message
   */
  public String getMessage() {
    return message;
  }

}
