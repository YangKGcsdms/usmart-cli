package com.yxzq.openapi.https.request;

import java.util.HashMap;
import java.util.Map;

/**
 * @title:
 * @projectName:
 * @description: TODO
 * @author: shizhibiao
 * @date: 2021/5/12 10:11
 */
public class OpenHttpRequest{

    private  Map<String, Object> parameters = new HashMap<>();

    public Map<String, Object> getParameters() {
        return parameters;
    }

    public void setParameters(Map<String, Object> parameters) {
        this.parameters = parameters;
    }
}
