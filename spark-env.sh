# Set Spark's public IP address so that the links in the UI work.
export SPARK_PUBLIC_DNS=`wget -q -O - http://checkip.amazonaws.com`
