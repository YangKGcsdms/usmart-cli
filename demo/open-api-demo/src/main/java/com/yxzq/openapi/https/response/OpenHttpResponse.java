package com.yxzq.openapi.https.response;

/**
 * @title:
 * @projectName:
 * @description: TODO
 * @author: shizhibiao
 * @date: 2021/5/12 10:11
 */
public class OpenHttpResponse<T> {

    private String code;

    private String msg;

    private T data;

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getMsg() {
        return msg;
    }

    public void setMsg(String msg) {
        this.msg = msg;
    }

    public T getData() {
        return data;
    }

    public void setData(T data) {
        this.data = data;
    }

    @Override
    public String toString() {
        return "OpenHttpResponse{" +
                "code='" + code + '\'' +
                ", msg='" + msg + '\'' +
                ", data=" + data +
                '}';
    }
}
