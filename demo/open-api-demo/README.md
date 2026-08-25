生产环境对接步骤请参考如下：
1、登录uSMART官网：https://www.usmart.hk/，点击右上角“注册/登录”
2、进入“个人中心” - “我的API”，获取生产对接的渠道号、公钥、私钥
3、接入demo下载链接：https://api-doc.usmart8.com/zh-cn/demo.html
4、API文档接口链接：https://api-doc.usmart8.com/zh-cn/

uat配置
base_url_jy = "http://open-jy-uat.yxzq.com"
base_url_hq = "https://open-hz-uat.yxzq.com"
quote_push_url = "wss://open-hz-uat.yxzq.com/wss/v1"
PUBLIC_KEY = MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCajLOdwFMIBQ8k3W48/e4bIj2EFc3O/T54oiLOk+KQgAknvmUHJp/1arN8g9tjAaBKPSbznTe4ZYX3VXI7VTRF7Dhi1+vCkas1OwWkdwzZWg3LOqfUORF3tFmvNOiLLzJQ6H5oLsNNZjMOr2QZrm4srzc1aX3O0BRwQhPkP/XhYwIDAQAB
PRIVATE_KEY = MIICdwIBADANBgkqhkiG9w0BAQEFAASCAmEwggJdAgEAAoGBAMOcIhl4WigWE81+neMfnxxywOD1UBGgWTPD87TT7WnZAKydDXMy3QAeVnRsgd+TExqUznqHkZ4W5SzWb6ymu1om0RxGn8DD5iaAMQ5JJE8s3HwElYfwT22Hh/mObQOg9JvNXfSriMq20dE2u4gpWUxCQXRk1a3MjEwAjvyIMPT5AgMBAAECgYAP5xGeoHoz6BeUDUcov9lfprSnlUn9JNwbqUKW4OPcRxgW8G23f9sXt1+v92JXms1iy9Y9f+gGwjW/f290ydlRRnV6xeynAn01Q1BVwoO+PTBIK0xU5Up+bAyScIawXg6Jo9c5uPQqq1jyIs3ks/mP7p6sqJ5bod7MEbiF+PJVQQJBAPKaS9H3aMIKiq7YAqvplfQ5OliBC0U8yMLBZusHXNqz+sVBdJW1wYDydNDKuxwnCYMFF5biXgGJtE+OBueH+YMCQQDOaX5rE1mWBw5W2Dmad2uH5FgtySNpwb6XqKnXPBhS/WBXQL/iaxP/HcCK1xImpig3Ow1FWVqLeFAryT0NbRrTAkEA0Qj77ZXlcNSOfGrpmmExcPbifCHsqSLfxVfJqxdz/Yn4uIBWySyL5+SBnOoh4PcN7hO0KLEx2NdjQu0Yq+TwqwJAbs+FlZgyvO8WzJqR+hHoQXDdwd68Szc+yY47d5gEevEZel4BZV0UxB3F0wN49BS5fEUQb81zZXJ2n7sOMpoDDwJBANvFnh/JPYWdQktanNw5qNTvt/WZqVFZnIVjF/tTRWZcVdcV6uYFLOOzs8wypvvtz/9w1AG+3Oppfh3A+zE05h8=
X_Channel = 914

生产配置：
base_url_jy = "https://open-jy.yxzq.com"
base_url_hq = "https://open-hz.yxzq.com:8443"
quote_push_url = "wss://open-hz.yxzq.com:8443/wss/v1"
PUBLIC_KEY = 官网申请的公钥
PRIVATE_KEY = 官网申请的私钥
X_Channel = 官网申请的渠道号

