const fs=require('fs');let p=fs.readFileSync('refresh.py','utf8');
p=p.replace(`       COUNT(DISTINCT h.intDeliveryId) AS deliveries, CAST(SUM(h.numTotalNetValue) AS BIGINT) AS value
FROM sms.tblDeliveryHeader h`,
`       COUNT(DISTINCT h.intDeliveryId) AS deliveries, CAST(SUM(h.numTotalNetValue) AS BIGINT) AS value,
       COUNT(DISTINCT h.intShipToPartnerId) AS partners
FROM sms.tblDeliveryHeader h`);
fs.writeFileSync('refresh.py',p);console.log('partners added');
