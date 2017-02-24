# Spark for Quilt.js
This document describes how to run Apache Spark on Quilt and pass it a job at
boot time. Specifically, we'll be running the SparkPI example to calculate the
value of π on our Quilt Spark cluster.

## Configuring QUILT_PATH
Quilt uses the `QUILT_PATH` environment variable to locate packages. See the
[Getting Started Guide](https://github.com/NetSys/quilt/blob/master/docs/GettingStarted.md#quilt_path)
for instructions on setting up your `QUILT_PATH`.

To fetch the Spark specs for Quilt, execute `quilt get github.com/quilt/spark`.

## SparkPi
The example SparkPi program distributes the computationally-intensive task of
calculating Pi over several machines in a computer cluster.

Our [sparkPI.js](sparkPI.js) Quilt.js specification simplifies the
task of setting up the infrastructure required to run this Spark job.

### Configure SSH authentication
Quilt-managed Machines use public key authentication to control SSH access.
To read the result of the Spark job, we will need to access the Master VM.

If you would like to use `githubKey` authentication, open
`$QUILT_PATH/github.com/quilt/spark/sparkPI.js` and set the `sshKeys` Machine
property appropriately:

```javascript
var baseMachine = new Machine({
    ...
    sshKeys: githubKeys("<YOUR_GITHUB_USERNAME>"),
    ...
});
```

For instructions on configuring a user-supplied public key and more information
on configuring Quilt SSH authentication, see
[GettingStarted.md](https://github.com/NetSys/quilt/blob/master/docs/GettingStarted.md#set-up-your-ssh-authentication).

### Build `sparkPI.js`
Start the Quilt daemon with `quilt daemon`. Then, in a separate shell, execute
`quilt run github.com/quilt/spark/sparkPI.js` to
build this Quilt.js specification.

Quilt will now begin provisioning several VMs on your cloud provider. Five VMs
will serve as Workers, and one will be the Master.

It will take a bit for the VMs to boot up, for Quilt to configure the network,
and for Docker containers to be initialized. The command `quilt ps` provides
uselful information about the VMs and containers in the deployment. 
The following output reports that the Master VM's public IP is `54.193.66.67`:

```
$ quilt ps
MACHINE         ROLE      PROVIDER    REGION       SIZE        PUBLIC IP         CONNECTED
12c000f87ccf    Master    Amazon      us-west-1    m4.large    54.193.66.67      true
4316db8165d3    Worker    Amazon      us-west-1    m4.large    54.183.187.137    true
...
```

When `CONNECTED` is `true`, the corresponding VM is fully booted and has begun
communicating with Quilt:

Once a machine is `CONNECTED`, you can ssh into to the VM with the command
`quilt ssh <MACHINE_ID>`, or manually with `ssh quilt@<PUBLIC_IP>`.
That is, in this case either `quilt ssh 12c000f87ccf` or
`ssh quilt@54.193.66.67`.

### Inspect Containers
To list all active containers in the cluster, execute `quilt ps` again, and
look for `CONTAINER` at the end of the output.  For example:

```
$ quilt ps
...
CONTAINER       MACHINE         COMMAND                   LABELS      STATUS     CREATED           PUBLIC IP
13d6b800086a    4316db8165d3    quilt/spark run master    spark-ms    running    34 seconds ago    54.183.187.137:8080

063f91f017b2    a7749c79b8fe    quilt/spark run worker    spark-wk    running    34 seconds ago    54.241.148.64:8081
...
```

### Recovering Pi
Once our Master Spark container is up, we can find the results of our SparkPi
job via logs.

Execute `quilt logs <CONTAINER_ID>` with the Spark Master node's ID retrieved
from the `quilt ps` output. After scrolling through Spark's info logging,
we find the result of SparkPi's computation of pi:

```
$ quilt logs 13d6b800086a
...
17/02/18 05:50:17 INFO Utils: Successfully started service 'SparkUI' on port 4040.
17/02/18 05:50:17 INFO SparkUI: Started SparkUI at http://10.167.115.156:4040
Pi is roughly 3.14344
17/02/18 05:50:17 INFO HttpFileServer: HTTP File server directory is /tmp/spark-86a8a695-ddd1-4026-892b-b16102e43ea6/httpd-071a6d96-1d05-4763-b2d8-c49cbfe67b0c
17/02/18 05:50:17 INFO HttpServer: Starting HTTP Server
...
```

Notice the line that says `Pi is roughly 3.14344`.

**Note:** The Spark cluster is now up and usable. You can run the interactive
spark-shell by exec-ing it in the Master Spark container:
`quilt exec -t <MASTER_CONTAINER_ID> spark-shell`. To tear down the deployment,
just execute `quilt stop`.

### More information
See [Quilt](http://quilt.io) for more information about Quilt.js.
