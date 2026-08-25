package com.yxzq.openapi.service;

import com.yxzq.openapi.https.request.OpenHttpRequest;
import com.yxzq.openapi.https.response.OpenHttpResponse;

/**
 * @title:
 * @projectName:
 * @description: TODO
 * @author: shizhibiao
 * @date: 2021/5/13 10:12
 */
public interface OpenApiService {

    OpenHttpResponse autologin(OpenHttpRequest openHttpRequest);

    OpenHttpResponse openapi(OpenHttpRequest openHttpRequest);

    OpenHttpResponse openapiHq(OpenHttpRequest openHttpRequest);

    void openapiHqPush(OpenHttpRequest openHttpRequest);



}
