package com.yxzq.openapi.example;

import com.yxzq.openapi.config.OpenApiUrl;
import com.yxzq.openapi.https.request.OpenHttpRequest;
import com.yxzq.openapi.https.response.OpenHttpResponse;
import com.yxzq.openapi.service.OpenApiService;
import com.yxzq.openapi.service.impl.OpenApiServiceImpl;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.HashMap;
import java.util.Map;

/**
 * @title:
 * @projectName: 自动登录返回 token
 * @description: TODO
 * @author: shizhibiao
 * @date: 2021/5/19 9:20
 */
public class AutoLoginDemo {

    private static final Logger logger = LoggerFactory.getLogger(AutoLoginDemo.class);

    static OpenApiService openApiService = new OpenApiServiceImpl();

    public static OpenHttpResponse login() {
        Map<String, Object> params = new HashMap<String, Object>();
        params.put("phoneNumber", "15210372164");
        params.put("password", "qwe123456");
        params.put("url", OpenApiUrl.login);
        OpenHttpRequest openHttpRequest = new OpenHttpRequest();
        openHttpRequest.setParameters(params);
        OpenHttpResponse openHttpResponse = openApiService.autologin(openHttpRequest);
        logger.info("自动登录返回对象：" + openHttpResponse);
        return openHttpResponse;
    }

}
