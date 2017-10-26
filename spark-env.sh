# Set Spark's public IP address so that the links in the UI work.
# XXX: SPARK_PUBLIC_DNS can be set in the blueprint once Kelda adds
# support for setting environment variables in the blueprint based on
# the public IP address.
export SPARK_PUBLIC_DNS=`wget -q -O - 2>&1 http://checkip.amazonaws.com`
