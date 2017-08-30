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
package org.exoplatform.videocalls.client;

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

  /** The Constant CODE_CLIENT_ERROR. */
  public static final String CODE_CLIENT_ERROR    = "CLIENT_ERROR";

  /** The Constant CODE_NOT_FOUND_ERROR. */
  public static final String CODE_NOT_FOUND_ERROR = "NOT_FOUND_ERROR";

  /** The Constant CODE_ACCESS_ERROR. */
  public static final String CODE_ACCESS_ERROR    = "ACCESS_ERROR";

  /** The Constant CODE_SERVER_ERROR. */
  public static final String CODE_SERVER_ERROR    = "SERVER_ERROR";

  /**
   * Client error.
   *
   * @param message the message
   * @return the error info
   */
  public static ErrorInfo clientError(String message) {
    return new ErrorInfo(CODE_CLIENT_ERROR, message);
  };

  /**
   * Not found error.
   *
   * @param message the message
   * @return the error info
   */
  public static ErrorInfo notFoundError(String message) {
    return new ErrorInfo(CODE_NOT_FOUND_ERROR, message);
  };

  /**
   * Access error.
   *
   * @param message the message
   * @return the error info
   */
  public static ErrorInfo accessError(String message) {
    return new ErrorInfo(CODE_ACCESS_ERROR, message);
  };

  /**
   * Server error.
   *
   * @param message the message
   * @return the error info
   */
  public static ErrorInfo serverError(String message) {
    return new ErrorInfo(CODE_SERVER_ERROR, message);
  };

  /** The code. */
  protected final String code;

  /** The message. */
  protected final String message;

  /**
   * Instantiates a new error info.
   *
   * @param code the code
   * @param message the message
   */
  public ErrorInfo(String code, String message) {
    this.code = code;
    this.message = message;
  }

  /**
   * Instantiates a new error info.
   *
   * @param message the message
   */
  public ErrorInfo(String message) {
    this(null, message);
  }

  /**
   * Gets the code.
   *
   * @return the code
   */
  public String getCode() {
    return code;
  }

  /**
   * Gets the message.
   *
   * @return the message
   */
  public String getMessage() {
    return message;
  }
  
  /**
   * Error as JSON string.
   *
   * @return the string
   */
  public String asJSON() {
    StringBuilder str = new StringBuilder();
    str.append("{\"code\": \"");
    str.append(code);
    str.append("\", \"message\": \"");
    str.append(message);
    str.append("\", \"error\": true}");
    return str.toString();
  }

}
